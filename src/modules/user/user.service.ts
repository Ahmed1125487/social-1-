import { unlink } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { cacheService, CacheService } from './../../Common/service/cache.service';
import { BadRequestException, ConflictException, NotFoundException } from "./../../Common/exception";
import { HUser } from "./../../DB/model/user.model";
import {
  jWTpayloadtype,
  tokenService,
  TokenService,
} from "./../../Common/service/token.service";
import { AccountStatusEnum, FollowStatusEnum, logoutEnum, ProviderEnum } from "./../../Common/enum";
import { FollowRepository, UserRepository } from "../../Common/repository";
import { IUser } from "./../../Common/interface/user.interface";
import { compare } from "./../../Common/security/hash.security";
import { decryption } from "./../../Common/security/encryption.security";
import { toObjectId } from "./../../Common/utils/objectId";
import { ChangePasswordDto, UpdateProfileDto } from "./dto/user.dto";
import { QueryFilter } from "mongoose";


export class UserService {
  private readonly tokenService: TokenService;
  private readonly userRepository: UserRepository;
  private readonly followRepository: FollowRepository;
  private readonly cacheService: CacheService;

  constructor() {
    this.tokenService = tokenService;
    this.userRepository = new UserRepository();
    this.followRepository = new FollowRepository();
    this.cacheService= cacheService
  }

  /* ---------------------- profile retrieval & updates ---------------------- */

  // phone is stored encrypted, the owner sees it decrypted
  private async toProfile(user: HUser) {
    const profile = user.toJSON() as Record<string, any>;
    if (user.phone) {
      try {
        profile.phone = await decryption(user.phone);
      } catch (error) {
        delete profile.phone;
      }
    }
    return profile;
  }

  async getProfile(user: HUser) {
    const [followers, following] = await Promise.all([
      this.followRepository.countDocuments({
        filter: { following: user._id, status: FollowStatusEnum.ACCEPTED },
      }),
      this.followRepository.countDocuments({
        filter: { follower: user._id, status: FollowStatusEnum.ACCEPTED },
      }),
    ]);
    return { user: await this.toProfile(user), followers, following };
  }

  async updateProfile(user: HUser, dto: UpdateProfileDto) {
    user.set(dto);
    await user.save();
    return await this.toProfile(user);
  }

  async updateImage(user: HUser, file: Express.Multer.File) {
    const oldImage = user.image;
    user.image = file.path;
    await user.save();
    // only ever delete files we stored ourselves inside assets/User
    if (oldImage) {
      const folder = resolve("assets/User") + sep;
      const oldPath = resolve(oldImage);
      if (oldPath.startsWith(folder)) await unlink(oldPath).catch(() => undefined);
    }
    return { image: user.image };
  }

  /* ----------------------- account settings & privacy ----------------------- */

  async setPrivacy(user: HUser, isPrivate: boolean) {
    user.isPrivate = isPrivate;
    await user.save();
    // a public account has nothing left to approve
    if (!isPrivate) {
      await this.followRepository.updateMany({
        filter: { following: user._id, status: FollowStatusEnum.PENDING },
        update: { status: FollowStatusEnum.ACCEPTED },
      });
    }
    return { isPrivate };
  }

  async changePassword(user: HUser, payload: jWTpayloadtype, { currentPassword, password }: ChangePasswordDto) {
    const account = await this.userRepository.findById({
      id: user._id,
      projection: "+password",
    });
    if (!account || account.provider !== ProviderEnum.SYSTEM) {
      throw new BadRequestException("this account signs in with google and has no password");
    }
    if (!(await compare(currentPassword, account.password))) {
      throw new BadRequestException("current password is incorrect");
    }
    if (await compare(password, account.password)) {
      throw new ConflictException("new password must be different from the current one");
    }
    account.password = password;
    await account.save();
    // keep this device logged in, sign out all the others
    await this.tokenService.revokeAllSessions({ userId: user.id, exceptSid: payload.sid });
    return;
  }

  // soft delete: the account is hidden (see the hooks in the user model), an admin can restore it
  async archiveAccount(user: HUser) {
    await this.userRepository.updateOne({
      filter: { _id: user._id },
      update: { status: AccountStatusEnum.ARCHIVE, changeCredentialsTime: new Date() },
    });
    await this.tokenService.revokeAllSessions({ userId: user.id });
    return;
  }

  async restoreAccount(id: string) {
    const result = await this.userRepository.updateOne({
      filter: { _id: toObjectId(id), paranoid: false } as QueryFilter<IUser>,
      update: { status: AccountStatusEnum.ACTIVE },
    });
    if (!result.matchedCount) throw new NotFoundException("no archived account with this id");
    return;
  }

  /* ---------------------- token refreshing & revocation ---------------------- */

  async rotateToken(payload: jWTpayloadtype, user: HUser, issuer: string) {
    return await this.tokenService.rotateCredentials({ payload, user, issuer });
  }

  async logout(payload:jWTpayloadtype, user:HUser, { action = logoutEnum.DEVICE }:{action?:logoutEnum}) {
    switch (action) {
      case logoutEnum.ALL:
        user.changeCredentialsTime = new Date();
        await user.save();
        await this.tokenService.revokeAllSessions({ userId: user.id });
        break;

      default:
        await this.tokenService.revokeSession({ payload });
        break;
    }

    return;
  }
}


export const userService = new UserService()
