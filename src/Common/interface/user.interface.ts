import { GenderEnum, RoleEnum, ProviderEnum, AccountStatusEnum } from "./../enum/user.enum";
export interface IUser {
  firstName: string;
  lastName?: string;
  username?: string;
  email: string;
  password: string;
  phone?: string;
  DOB?: Date;
  bio?: string;
  confirmEmail?: Date;
  image?: string;
  coverImage?: string[];
  gender: GenderEnum;
  role: RoleEnum;
  provider: ProviderEnum;
  isPrivate: boolean;
  changeCredentialsTime?: Date;
  createdAt?: string;
  updatedAt?: string;
  status:AccountStatusEnum;
  changeStatusAt?:Date
}
