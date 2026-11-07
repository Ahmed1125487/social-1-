import { encryption } from './../../Common/security/encryption.security';
import { hash } from './../../Common/security/hash.security';
import { IUser } from './../../Common/interface/user.interface';
import { ProviderEnum, GenderEnum, RoleEnum, AccountStatusEnum } from './../../Common/enum/user.enum';
import mongoose, { HydratedDocument } from "mongoose";

export const userSchema = new mongoose.Schema<IUser>(
  {
    firstName: {
      type: String,
      required: true,
      maxLength: 25,
      minLength: 2,
    },
    lastName: {
      type: String,
      maxLength: 25,
      minLength: 2,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      select: false,
      required: function ():boolean {
        return this.provider === ProviderEnum.SYSTEM;
      },
    },
    phone: String,
    DOB: Date,
    bio: { type: String, maxLength: 160 },
    confirmEmail: Date,
    image: String,
    coverImage: [String],
    isPrivate: { type: Boolean, default: false },
    status:{type:Number, enum:AccountStatusEnum, default:AccountStatusEnum.ACTIVE},
    changeStatusAt:Date,
    gender: {
      type: Number,
      enum: GenderEnum,
      default: GenderEnum.MALE,
    },
    role: {
      type: Number,
      enum: RoleEnum,
      default: RoleEnum.USER,
    },
    provider: {
      type: Number,
      enum: ProviderEnum,
      default: ProviderEnum.SYSTEM,
    },
    changeCredentialsTime: Date,
  },
  {
    strict: true,
    strictQuery: true,
    timestamps: true,
    toObject: { virtuals: true },
    toJSON: {
      virtuals: true,
      transform: (_doc: unknown, ret: Record<string, any>) => {
        delete ret.password;
        delete ret.__v;
        return ret;
      },
    },
    autoIndex: true,
  },
);

userSchema
  .virtual("username")
  .set(function (value:string) {
    const [firstName, ...rest] = value?.trim().split(/\s+/) || [];
    this.set({ firstName, lastName: rest.join(" ") || undefined });
  })
  .get(function () {
    return [this.firstName, this.lastName].filter(Boolean).join(" ");
  });


userSchema.pre('save',async function(){
  if (this.isModified('password') && this.password) {
    this.password= await hash(this.password)
  }
  if (this.isModified('phone') && this.phone) {
    this.phone= await encryption(this.phone as string)
  }
})

userSchema.pre('validate',function(){
  if (this.provider== ProviderEnum.GOOGLE&& this.password) {
    throw new Error('google ac cannot hold pass')
  }
})


// soft delete: archived accounts are hidden from every query unless the filter says { paranoid: false }
userSchema.pre(['findOne','find','countDocuments'], function () {
  const query= this.getFilter()
  if (query.paranoid!=false)  this.setQuery({...query,status:{$ne:AccountStatusEnum.ARCHIVE}})

})
userSchema.pre(['updateOne', 'updateMany','findOneAndUpdate'], function () {
  const query= this.getFilter()
  const update=(this.getUpdate() ?? {}) as Record<string, any>
  if (update.status === AccountStatusEnum.ACTIVE ) {
   // restore: only an archived account can be activated
   this.setQuery({...query,status:{$eq:AccountStatusEnum.ARCHIVE}})
  }else if(update.status === AccountStatusEnum.ARCHIVE){
   this.setQuery({...query,status:{$ne:AccountStatusEnum.ARCHIVE}})
  }else if (query.paranoid != false) {
     this.setQuery({...query,status:{$ne:AccountStatusEnum.ARCHIVE}})
  }

  if (update.status !== undefined) {
    this.setUpdate({ ...update, changeStatusAt: new Date() })
  }
})
userSchema.pre(['deleteOne', 'deleteMany','findOneAndDelete'], function () {
  const query= this.getFilter()

  if (!query.force ) {
     this.setQuery({...query,status:{$eq:AccountStatusEnum.ARCHIVE}})
  }
})

export const UserModel =
  mongoose.models.User || mongoose.model<IUser>("User", userSchema);
export type HUser=HydratedDocument <IUser>
