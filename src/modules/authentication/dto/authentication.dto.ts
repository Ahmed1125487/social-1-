import { confirmEmail, forgotPassword, login, resendConfirmEmail, resetForgotPassword, signup, signupWithGmail } from './../authentication.validation';
import {z} from "zod";

export type SignupDto = z.infer<ReturnType<typeof signup>>
export type SignupWithGmailDto = z.infer<ReturnType<typeof signupWithGmail>>['body']
export type ConfirmEmailDto = z.infer<ReturnType<typeof confirmEmail>>['body']
export type ReSendConfirmEmailDto = z.infer<ReturnType<typeof resendConfirmEmail>>['body']
export type ForgotPasswordDto = z.infer<ReturnType<typeof forgotPassword>>['body']
export type ResetForgotPasswordDto = z.infer<ReturnType<typeof resetForgotPassword>>['body']
export type LoginDto = z.infer<ReturnType<typeof login>>['body']
