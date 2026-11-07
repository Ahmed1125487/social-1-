import { WEB_CLIENT_ID } from './../../config';
import { ILoginResponse, ISignupWithGmailResponse } from './entities/authentication.entities';
import { tokenService, TokenService } from './../../Common/service';
import { IUser } from './../../Common/interface/user.interface';
import { ProviderEnum } from './../../Common/enum/user.enum';
import { createOtp } from './../../Common/utils/otp';
import { emailEvent } from './../../Common/utils/email/email.event';
import { userEmailKey, userEmailTrailsKey, userEmailAttemptsKey } from './../../Common/utils/email/send.email';
import { EmailSubjectEnum } from './../../Common/enum/email.enum';
import { compare, hash } from './../../Common/security/hash.security';
import  { CacheService ,cacheService } from './../../Common/service';
import { ApplicationException, ConflictException, TooManyRequestException, NotFoundException, BadRequestException, UnAuthorizedException, ForBiddenException } from './../../Common/exception';
import { SignupDto, ConfirmEmailDto, ReSendConfirmEmailDto, LoginDto, SignupWithGmailDto, ForgotPasswordDto, ResetForgotPasswordDto } from './dto/authentication.dto';
import { UserRepository } from '../../Common/repository';
import { OAuth2Client, TokenPayload } from 'google-auth-library';
import { QueryFilter } from 'mongoose';

const MAX_OTP_ATTEMPTS = 5;

export class AuthenticationService{
    private userRepository:UserRepository
    private cacheService:CacheService
    private tokenService:TokenService
    private client :OAuth2Client
    constructor(){
        this.userRepository= new UserRepository()
        this.cacheService= cacheService
        this.tokenService=tokenService
        this.client = new OAuth2Client()
    }

/* ------------------------- Google OAuth 2.0 ------------------------- */

async  verifyGoogleAccount(idToken:string): Promise<TokenPayload> {
  if (!WEB_CLIENT_ID.length) {
    throw new BadRequestException("google sign in is not configured");
  }
  let payload: TokenPayload | undefined;
  try {
    const ticket = await this.client.verifyIdToken({
      idToken,
      audience: WEB_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch (error) {
    throw new UnAuthorizedException("invalid google token");
  }
  if (!payload?.email || !payload.email_verified) {
    throw new BadRequestException("email not verified");
  }

  return payload;
}



async  signupWithGmail ({ idToken }:SignupWithGmailDto, issuer:string):Promise<ISignupWithGmailResponse>  {

  const { name, email, picture } = await this.verifyGoogleAccount(idToken);
  const existAccount = await this.userRepository.findOne({
    filter: { email : email as string , paranoid:false } as QueryFilter<IUser>,
  });
  if (existAccount) {
    if (existAccount.provider != ProviderEnum.GOOGLE) {
      throw new  ConflictException("invalid account provider");
    }
    return {
      status: 200,
      data: await  this.tokenService.createLoginCredentials({ user: existAccount, issuer }),
    };
  }

  const user = await this.userRepository.createOne({
    data: {
      username: name ?? (email as string).split("@")[0],
      email,
      confirmEmail: new Date(),
      provider: ProviderEnum.GOOGLE,
      ...(picture ? { image: picture } : {}),
    },
  });
  return { status: 201, data: await this.tokenService.createLoginCredentials({ user, issuer }) };
};

/* ------------------------------- OTP ------------------------------- */

    async sendEmailOtp  ({
  email,
  subject,
  expiresIn = 120,
  maxTrails = 3,
  blockInSeconds= 300,
  title
}:{
  email:string,
  subject:EmailSubjectEnum,
  expiresIn?:number,
  maxTrails?:number,
  blockInSeconds?:number,
  title?:string
})  {
  const existOtp_ttl = await this.cacheService.ttlCache({
    key: userEmailKey({ email, subject }),
  });
  if (existOtp_ttl > 0) {
    throw new ConflictException(
      `sorry we can't create a new otp while there is a valid one try again after ${existOtp_ttl}s`,
    );
  }
  const oldTrails =
    (await this.cacheService.getCache({ key: userEmailTrailsKey({ email, subject }) })) ?? 0;
  if (oldTrails >= maxTrails) {
    throw new TooManyRequestException("max otp trails has been reached");
  }
  const code = createOtp();
  await this.cacheService.setCache({
    key: userEmailKey({ email, subject }),
    value: await hash(code.toString()),
    ttl: expiresIn,
  });
  // a new code starts with a fresh set of wrong guesses
  await this.cacheService.deleteCache({ key: userEmailAttemptsKey({ email, subject }) });
  const currentTrails = await this.cacheService.incrementByCache({
    key: userEmailTrailsKey({ email, subject }),
  });
  if (currentTrails == 1) {
    await this.cacheService.expireCache({key:  userEmailTrailsKey({email, subject}), ttl : 900})
  }
  if (currentTrails >= maxTrails) {
    await this.cacheService.expireCache({key:  userEmailTrailsKey({email, subject}), ttl : blockInSeconds})
  }
  emailEvent.emit("sendEmail", {
    recipients: { to: email },
    subject,
    data: { code,title: title??subject },
  });
};

async verifyEmailOtp ({ email, subject, otp }:{ email:string, subject:EmailSubjectEnum, otp:string }):Promise<void> {
  const otpKey = userEmailKey({ email, subject });
  const attemptsKey = userEmailAttemptsKey({ email, subject });
  const hashOtp = await this.cacheService.getCache({ key: otpKey });
  if (!hashOtp) {
    throw new BadRequestException("invalid or expired OTP");
  }
  const attempts = await this.cacheService.incrementByCache({ key: attemptsKey });
  if (attempts == 1) {
    await this.cacheService.expireCache({ key: attemptsKey, ttl: 900 });
  }
  if (attempts > MAX_OTP_ATTEMPTS) {
    await this.cacheService.deleteCache({ key: [otpKey, attemptsKey] });
    throw new TooManyRequestException("too many wrong attempts, ask for a new OTP");
  }
  if (!(await compare(otp, String(hashOtp)))) {
    throw new BadRequestException("invalid or expired OTP");
  }
  await this.cacheService.deleteCache({ key: [otpKey, attemptsKey] });
};

// an unknown email and a cool-down must look the same to the caller, otherwise the answer
// tells a stranger whether an email has an account
private async sendOtpQuietly (email:string, subject:EmailSubjectEnum) {
  try {
    await this.sendEmailOtp({ email, subject });
  } catch (error) {
    if (!(error instanceof ApplicationException)) throw error;
  }
}

/* ------------------- registration + email verification ------------------- */

async signup ({ body }:SignupDto):Promise<IUser> {
  const { email, password, username, phone, gender } = body;
  const duplicatedAccount = await this.userRepository.findOne({
    filter: { email , paranoid:false } as QueryFilter<IUser>,
  });
  if (duplicatedAccount) throw new ConflictException("Email Exist");
  const account = await this.userRepository.createOne({
    data: {
      email,
      password,
      username,
      ...(phone ? { phone } : {}),
      ...(gender !== undefined ? { gender } : {}),
    },
  });

  await this.sendEmailOtp({ email, subject: EmailSubjectEnum.CONFIRM_EMAIL });
  return account;
};
async confirmEmail ({ email, otp }:ConfirmEmailDto):Promise<void>  {
  const account = await this.userRepository.findOne({
    filter: {
      email,
      provider: ProviderEnum.SYSTEM,
      confirmEmail: { $exists: false },
    },
  });
  if (!account) throw new  NotFoundException("invalid account");

  await this.verifyEmailOtp({ email, subject: EmailSubjectEnum.CONFIRM_EMAIL, otp });
  account.confirmEmail = new Date();
  await account.save();
  return;
};
async reSendConfirmEmail ({ email }:ReSendConfirmEmailDto):Promise<void>  {
  const account = await this.userRepository.findOne({
    filter: {
      email,
      provider: ProviderEnum.SYSTEM,
      confirmEmail: { $exists: false },
    },
  });
  if (!account) throw new  NotFoundException("invalid account");

  await this.sendEmailOtp({ email, subject: EmailSubjectEnum.CONFIRM_EMAIL });

  return;
};

/* ------------------------ login + session generation ------------------------ */

async login({ email, password }:LoginDto , issuer:string):Promise<ILoginResponse>  {
  const account = await this.userRepository.findOne({
    filter: {
      email,
      provider: ProviderEnum.SYSTEM,
    },
    projection: "+password",
  });
  if (!account || !(await compare(password, account.password))) {
    throw new UnAuthorizedException("Invalid email or password");
  }
  if (!account.confirmEmail) {
    throw new ForBiddenException("Please confirm your email first");
  }

  return await this.tokenService.createLoginCredentials({ user: account, issuer });
};

/* ------------------------ password reset (OTP) ------------------------ */

async forgotPassword ({ email }:ForgotPasswordDto):Promise<void> {
  const account = await this.userRepository.findOne({
    filter: {
      email,
      provider: ProviderEnum.SYSTEM,
      confirmEmail: { $exists: true },
    },
  });
  if (account) await this.sendOtpQuietly(email, EmailSubjectEnum.FORGET_PASSWORD);
  return;
};

async resetForgotPassword ({ email, otp, password }:ResetForgotPasswordDto):Promise<void> {
  const account = await this.userRepository.findOne({
    filter: {
      email,
      provider: ProviderEnum.SYSTEM,
      confirmEmail: { $exists: true },
    },
  });
  if (!account) throw new BadRequestException("invalid or expired OTP");

  await this.verifyEmailOtp({ email, subject: EmailSubjectEnum.FORGET_PASSWORD, otp });
  account.password = password;
  // every token issued before this moment stops working (all devices are logged out)
  account.changeCredentialsTime = new Date();
  await account.save();
  return;
};

}
export default new AuthenticationService()
