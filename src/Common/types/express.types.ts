import { jWTpayloadtype } from './../service/token.service';
import { HUser } from './../../DB/model/user.model';
declare module "express-serve-static-core"{
    interface Request {
        validate:any;
        user:HUser;
        payload:jWTpayloadtype
    }
}