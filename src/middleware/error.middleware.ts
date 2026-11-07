import { IError } from './../Common/interface';
import { NODE_ENV } from './../config';
import type{ NextFunction, Request, Response } from "express"



export const globalErrorHandling=(error:IError,req:Request,res:Response,next:NextFunction):Response=>{
    const status = error.status ?? (error as any).statusCode ?? 500
    const isProduction = NODE_ENV === 'production'
    return res.status(status).json({
        status,
        error_message: status === 500 && isProduction ? 'server error' : error.message||'server error',
        cause:error.cause,
        // the stack trace is for developers only
        ...(isProduction ? {} : { stack:error.stack })
    })
}

export const notFoundHandling=(req:Request,res:Response):Response=>{
    return res.status(404).json({
        status:404,
        error_message:`${req.method} ${req.originalUrl} not found`
    })
}
