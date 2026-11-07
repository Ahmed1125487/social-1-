import { randomInt } from "node:crypto";

export const createOtp= ():number=>{
    return randomInt(100000, 1000000)
}
