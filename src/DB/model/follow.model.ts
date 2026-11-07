import { IFollow } from './../../Common/interface/follow.interface';
import { FollowStatusEnum } from './../../Common/enum/user.enum';
import mongoose, { HydratedDocument } from "mongoose";

export const followSchema = new mongoose.Schema<IFollow>(
  {
    follower: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    following: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: {
      type: Number,
      enum: FollowStatusEnum,
      default: FollowStatusEnum.ACCEPTED,
    },
  },
  {
    strict: true,
    strictQuery: true,
    timestamps: true,
    autoIndex: true,
  },
);

// one row per (follower, following) pair
followSchema.index({ follower: 1, following: 1 }, { unique: true });
followSchema.index({ following: 1, status: 1 });

export const FollowModel =
  mongoose.models.Follow || mongoose.model<IFollow>("Follow", followSchema);
export type HFollow = HydratedDocument<IFollow>;
