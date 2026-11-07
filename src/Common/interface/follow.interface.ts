import mongoose from "mongoose";
import { FollowStatusEnum } from "./../enum/user.enum";

export interface IFollow {
  follower: mongoose.Types.ObjectId;
  following: mongoose.Types.ObjectId;
  status: FollowStatusEnum;
  createdAt?: Date;
  updatedAt?: Date;
}
