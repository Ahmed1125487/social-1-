import { UserModel } from './../../DB/model/user.model';
import { IUser } from './../interface/user.interface';
import { DataBaseRepository } from './base.repository';

export  class UserRepository extends DataBaseRepository<IUser> {
  constructor() {
    super(UserModel)
  }


}
