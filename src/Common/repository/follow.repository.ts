import { FollowModel } from './../../DB/model/follow.model';
import { IFollow } from './../interface/follow.interface';
import { DataBaseRepository } from './base.repository';

export  class FollowRepository extends DataBaseRepository<IFollow> {
  constructor() {
    super(FollowModel)
  }


}
