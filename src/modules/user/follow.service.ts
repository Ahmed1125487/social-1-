import { Types } from "mongoose";
import { FollowStatusEnum } from "./../../Common/enum";
import { BadRequestException, ConflictException, ForBiddenException, NotFoundException } from "./../../Common/exception";
import { FollowRepository, UserRepository } from "../../Common/repository";
import { toObjectId } from "./../../Common/utils/objectId";
import { HUser } from "./../../DB/model/user.model";

type Relation = "self" | "following" | "requested" | "none";

// the only user fields other people are allowed to see in lists
const CARD_FIELDS = "firstName lastName image isPrivate";
const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export class FollowService {
  private readonly userRepository: UserRepository;
  private readonly followRepository: FollowRepository;

  constructor() {
    this.userRepository = new UserRepository();
    this.followRepository = new FollowRepository();
  }

  private card(user: HUser) {
    return {
      id: user.id as string,
      username: user.username as string,
      image: user.image ?? null,
      isPrivate: !!user.isPrivate,
    };
  }

  private async relation(viewerId: Types.ObjectId, targetId: Types.ObjectId): Promise<Relation> {
    if (viewerId.equals(targetId)) return "self";
    const row = await this.followRepository.findOne({
      filter: { follower: viewerId, following: targetId },
    });
    if (!row) return "none";
    return row.status === FollowStatusEnum.ACCEPTED ? "following" : "requested";
  }

  private async counts(id: Types.ObjectId) {
    const [followers, following] = await Promise.all([
      this.followRepository.countDocuments({
        filter: { following: id, status: FollowStatusEnum.ACCEPTED },
      }),
      this.followRepository.countDocuments({
        filter: { follower: id, status: FollowStatusEnum.ACCEPTED },
      }),
    ]);
    return { followers, following };
  }

  // confirmed and not archived (archived users are hidden by the user model hooks)
  private async findVisibleUser(id: string): Promise<HUser> {
    const user = await this.userRepository.findOne({
      filter: { _id: toObjectId(id), confirmEmail: { $exists: true } },
    });
    if (!user) throw new NotFoundException("user not found");
    return user;
  }

  private async assertCanSee(viewer: HUser, target: HUser) {
    const relation = await this.relation(viewer._id, target._id);
    if (target.isPrivate && relation !== "self" && relation !== "following") {
      throw new ForBiddenException("this account is private");
    }
  }

  /* --------------------------- another user's profile --------------------------- */

  async profile(viewer: HUser, id: string) {
    const target = await this.findVisibleUser(id);
    const relation = await this.relation(viewer._id, target._id);
    // a private profile only shows its card + counts until the follow request is accepted
    const canSeeMore = !target.isPrivate || relation === "self" || relation === "following";
    return {
      ...this.card(target),
      relation,
      ...(await this.counts(target._id)),
      ...(canSeeMore ? { bio: target.bio ?? null } : {}),
    };
  }

  /* ----------------------------- follow / unfollow ----------------------------- */

  async follow(me: HUser, id: string) {
    if (me.id === id) throw new BadRequestException("you cannot follow yourself");
    const target = await this.findVisibleUser(id);

    const existing = await this.followRepository.findOne({
      filter: { follower: me._id, following: target._id },
    });
    if (existing) {
      throw new ConflictException(
        existing.status === FollowStatusEnum.ACCEPTED
          ? "you already follow this user"
          : "your follow request is still pending",
      );
    }
    // a private account has to approve the request first
    const status = target.isPrivate ? FollowStatusEnum.PENDING : FollowStatusEnum.ACCEPTED;
    await this.followRepository.createOne({
      data: { follower: me._id, following: target._id, status },
    });
    return { status: status === FollowStatusEnum.ACCEPTED ? "following" : "requested" };
  }

  // also cancels a pending request
  async unfollow(me: HUser, id: string) {
    const result = await this.followRepository.deleteOne({
      filter: { follower: me._id, following: toObjectId(id) },
    });
    if (!result.deletedCount) throw new NotFoundException("you are not following this user");
    return;
  }

  /* ----------------------------- follow requests ----------------------------- */

  async requests(me: HUser, page: number, limit: number) {
    const result = await this.followRepository.paginate({
      filter: { following: me._id, status: FollowStatusEnum.PENDING },
      options: {
        sort: { createdAt: -1 },
        populate: [{ path: "follower", select: CARD_FIELDS }],
      },
      page,
      limit,
    });
    const { docs, ...meta } = result;
    return {
      ...meta,
      docs: docs
        .filter((row) => row.follower)
        .map((row) => ({ ...this.card(row.follower as unknown as HUser), requestedAt: row.createdAt })),
    };
  }

  async acceptRequest(me: HUser, id: string) {
    const result = await this.followRepository.updateOne({
      filter: { follower: toObjectId(id), following: me._id, status: FollowStatusEnum.PENDING },
      update: { status: FollowStatusEnum.ACCEPTED },
    });
    if (!result.matchedCount) throw new NotFoundException("no pending request from this user");
    return;
  }

  async rejectRequest(me: HUser, id: string) {
    const result = await this.followRepository.deleteOne({
      filter: { follower: toObjectId(id), following: me._id, status: FollowStatusEnum.PENDING },
    });
    if (!result.deletedCount) throw new NotFoundException("no pending request from this user");
    return;
  }

  /* ----------------------------- followers / following ----------------------------- */

  async connections(viewer: HUser, id: string, side: "followers" | "following", page: number, limit: number) {
    const target = await this.findVisibleUser(id);
    await this.assertCanSee(viewer, target);

    const populateField = side === "followers" ? "follower" : "following";
    const result = await this.followRepository.paginate({
      filter:
        side === "followers"
          ? { following: target._id, status: FollowStatusEnum.ACCEPTED }
          : { follower: target._id, status: FollowStatusEnum.ACCEPTED },
      options: {
        sort: { createdAt: -1 },
        populate: [{ path: populateField, select: CARD_FIELDS }],
      },
      page,
      limit,
    });
    const { docs, ...meta } = result;
    return {
      ...meta,
      docs: docs
        .filter((row) => row[populateField])
        .map((row) => this.card(row[populateField] as unknown as HUser)),
    };
  }

  /* ----------------------------- search & suggestions ----------------------------- */

  // every word of the query has to start the first or the last name ("jo smi" finds "John Smith")
  async search(me: HUser, { q, page, limit }: { q: string; page: number; limit: number }) {
    const words = q.split(/\s+/).filter(Boolean);
    const result = await this.userRepository.paginate({
      filter: {
        confirmEmail: { $exists: true },
        _id: { $ne: me._id },
        $and: words.map((word) => {
          const regex = new RegExp(`^${escapeRegex(word)}`, "i");
          return { $or: [{ firstName: regex }, { lastName: regex }] };
        }),
      },
      options: { select: CARD_FIELDS, sort: { firstName: 1, lastName: 1 } },
      page,
      limit,
    });
    const { docs, ...meta } = result;
    return { ...meta, docs: docs.map((user) => this.card(user)) };
  }

  // people followed by the people I follow (most shared first), then the newest members
  async suggestions(me: HUser, limit: number) {
    const mine = await this.followRepository.find({
      filter: { follower: me._id },
      options: { select: "following status" },
    });
    const exclude = [me._id, ...mine.map((row) => row.following)];
    const accepted = mine
      .filter((row) => row.status === FollowStatusEnum.ACCEPTED)
      .map((row) => row.following);

    const mutuals = new Map<string, number>();
    if (accepted.length) {
      const secondLevel = await this.followRepository.find({
        filter: {
          follower: { $in: accepted },
          status: FollowStatusEnum.ACCEPTED,
          following: { $nin: exclude },
        },
        options: { select: "following", limit: 1000 },
      });
      for (const row of secondLevel) {
        const key = String(row.following);
        mutuals.set(key, (mutuals.get(key) ?? 0) + 1);
      }
    }

    const rankedIds = [...mutuals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id]) => toObjectId(id));
    const ranked = rankedIds.length
      ? await this.userRepository.find({
          filter: { _id: { $in: rankedIds }, confirmEmail: { $exists: true } },
          options: { select: CARD_FIELDS },
        })
      : [];
    const docs = ranked
      .map((user) => ({ ...this.card(user), mutualFollowing: mutuals.get(user.id) ?? 0 }))
      .sort((a, b) => b.mutualFollowing - a.mutualFollowing);

    // a new account has no graph yet, so fill the list with the newest members
    if (docs.length < limit) {
      const fill = await this.userRepository.find({
        filter: {
          _id: { $nin: [...exclude, ...ranked.map((user) => user._id)] },
          confirmEmail: { $exists: true },
        },
        options: { select: CARD_FIELDS, sort: { createdAt: -1 }, limit: limit - docs.length },
      });
      docs.push(...fill.map((user) => ({ ...this.card(user), mutualFollowing: 0 })));
    }
    return { docs };
  }
}

export const followService = new FollowService();
