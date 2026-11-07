import { RoleEnum } from './../Common/enum/user.enum';
import { tokenService } from './../Common/service/token.service';
import { UnAuthorizedException, BadRequestException, ForBiddenException } from './../Common/exception/domain.exception';
import { tokenTypeEnum } from './../Common/enum/security.enum';
import { NextFunction, Request, Response } from 'express';


export const bearerAuth= async({req, tokenType =tokenTypeEnum.ACCESS }:{req:Request, tokenType :tokenTypeEnum })=>{
  const [key,credentials ]= req.headers["authorization"]?.trim().split(/\s+/) || []
  if (!credentials) {
    throw new UnAuthorizedException("UnAuthorized Account");
  }

      const { user, payload } = await tokenService.decodeToken({
        authorization: credentials as string,
        tokenType
      });
      req.user = user;
      req.payload = payload;
}

export const authentication = (tokenType = tokenTypeEnum.ACCESS, allowBasic = false) => {
  return async (req:Request, res:Response, next:NextFunction) => {
    const { authorization } = req.headers;

    if (!authorization) {
      throw new UnAuthorizedException("UnAuthorized Account");
    }
    const [key, credentials] = authorization.trim().split(/\s+/);

    switch (key) {
      case "Basic":
        if (!allowBasic) {
          throw new BadRequestException('Invalid authentication approach ')
        }
        const [email,password] = Buffer.from(credentials as string,'base64').toString().split(":")as [string,string]
        req.user=await tokenService.basicAuth({email,password})
        break;
      case "Bearer":
       await bearerAuth({req ,tokenType})
        break;
      default:
       throw new BadRequestException('Invalid authentication approach ')
    }
    next();
  };
};
export const authorization = (accessRole:RoleEnum) => {
  return async (req:Request, res:Response, next:NextFunction) => {

    if (req.user.role<accessRole) {
      throw new ForBiddenException("Forbidden Account");
    }

    next();
  };
};
