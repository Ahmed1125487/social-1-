import { Request } from "express";

export const getIssuer = (req:Request)=>{
    return `${req.protocol}://${req.host}`
}