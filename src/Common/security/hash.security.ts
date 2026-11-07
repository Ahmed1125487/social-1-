import bcrypt from 'bcrypt'
import { SALT } from '../../config.js'



export const hash =async (plainText:string,salt_round:number=SALT,minor:'a'|'b'='b'):Promise<string>=>{
const saltSignature=await bcrypt.genSalt(salt_round,minor)
const cipherText = await bcrypt.hash(plainText,saltSignature)
return cipherText
}

export const compare =async (plainText:string,cipherText: string):Promise<boolean>=>{
const match = await bcrypt.compare(plainText,cipherText)
return match
}
