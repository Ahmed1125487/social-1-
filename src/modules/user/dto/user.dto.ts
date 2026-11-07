import { changePassword, logout, updateProfile } from './../user.validation';
import {z} from "zod";

export type LogoutDto = z.infer<ReturnType<typeof logout>>['body']
export type UpdateProfileDto = z.infer<ReturnType<typeof updateProfile>>['body']
export type ChangePasswordDto = z.infer<ReturnType<typeof changePassword>>['body']
