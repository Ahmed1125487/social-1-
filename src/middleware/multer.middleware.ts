import { NextFunction, Request, RequestHandler, Response } from 'express';
import { processMulterUpload } from '../Common/utils/multer';
import { BadRequestException } from '../Common/exception';

export const uploadMiddleware = ({
  isRequired=true,
  multerMiddleware,
  customPath = "general",
  validation = [],
}:{
   isRequired?:boolean,
  multerMiddleware:RequestHandler,
  customPath ?:string,
  validation:string[],
}) => {
  return (req:Request, res:Response, next:NextFunction) => {
    multerMiddleware(req, res, async (error?:any) => {
      if (error) {
        next(error instanceof BadRequestException ? error : new BadRequestException(error.message));
        return;
      }
      try {

        await processMulterUpload({ customPath, validation, req,isRequired  });
        next();
      } catch (error:any) {
        next(error?.status ? error : new BadRequestException(error.message));
      }
    });
  };
};
