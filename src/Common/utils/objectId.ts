import mongoose from "mongoose";

export const toObjectId = (id: string): mongoose.Types.ObjectId => {
  return mongoose.Types.ObjectId.createFromHexString(id);
};
