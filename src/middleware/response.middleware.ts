import { IResponse } from "./../Common/interface/response.interface";
import { NextFunction, Request, RequestHandler, Response } from "express";

export const responseFormatter = (handler: Function):RequestHandler => {
  return async (req: Request, res: Response, next: NextFunction):Promise<Response | void> => {
    const {
      status = 200,
      message = true,
      data = undefined,
      extra = undefined,
    }: IResponse = await handler(req, res, next) ||{};
    if(res.headersSent)return
    return res.status(status).json({ message, status, data, extra });
  };
};
