import { compare } from "./../security/hash.security";
import { HUser } from "./../../DB/model/user.model";
import { toObjectId } from "./../utils/objectId";
import {
  UnAuthorizedException,
  NotFoundException,
} from "./../exception/domain.exception";
import { tokenTypeEnum } from "./../enum/security.enum";
import { RoleEnum, ProviderEnum } from "./../enum/user.enum";
import {
  ACCESS_USER_TOKEN_SIGNATURE,
  REFRESH_ADMIN_TOKEN_SIGNATURE,
  ACCESS_ADMIN_TOKEN_SIGNATURE,
  REFRESH_USER_TOKEN_SIGNATURE,
  ACCESS_TOKEN_EXPIRES_IN,
  REFRESH_TOKEN_EXPIRES_IN,
} from "./../../config";
import { cacheService, CacheService } from "./cache.service";
import { UserRepository } from "../repository";
import mongoose from "mongoose";
import jwt, { JwtPayload, Secret, SignOptions } from "jsonwebtoken";
import { BadRequestException } from "../exception/domain.exception.js";
import { randomUUID } from "node:crypto";
type UserIdType = mongoose.Types.ObjectId | string;
export type jWTpayloadtype = JwtPayload & {
  sub: string;
  sid: string;
  aud: string[];
  jti: string;
  iat: number;
};
export class TokenService {
  private readonly userRepository: UserRepository;
  private readonly cacheService: CacheService;

  constructor() {
    this.userRepository = new UserRepository();
    this.cacheService = cacheService;
  }

  userBaseKey({ userId }: { userId: UserIdType }): string {
    return `User::${userId.toString()}`;
  }
  // every login is a session: User::<id>::Session::<sid> = <jti of the refresh token that is valid right now>
  userBaseSessionKey({ userId }: { userId: UserIdType }): string {
    return `${this.userBaseKey({ userId })}::Session`;
  }
  userSessionKey({ userId, sid }: { userId: UserIdType; sid: string }): string {
    return `${this.userBaseSessionKey({ userId })}::${sid}`;
  }

  async generateToken({
    payload,
    options,
    secret = ACCESS_USER_TOKEN_SIGNATURE,
  }: {
    payload: string | Buffer | object;
    secret: Secret;
    options?: SignOptions;
  }): Promise<string> {
    const signingSecret = secret ?? ACCESS_USER_TOKEN_SIGNATURE;
    return jwt.sign(payload, signingSecret, options);
  }

  async verifyToken({
    token = "",
    secret = ACCESS_USER_TOKEN_SIGNATURE,
  }: {
    token: string;
    secret: Secret;
  }): Promise<jWTpayloadtype> {
    const verificationSecret = secret ?? ACCESS_USER_TOKEN_SIGNATURE;
    return jwt.verify(token, verificationSecret) as jWTpayloadtype;
  }

  async getTokenSignature({
    role = RoleEnum.USER,
  }: {
    role: RoleEnum;
  }): Promise<{
    accessSignature: string;
    refreshSignature: string;
  }> {
    let signature: {
      accessSignature: string;
      refreshSignature: string;
    };
    switch (role) {
      case RoleEnum.ADMIN:
        signature = {
          accessSignature: ACCESS_ADMIN_TOKEN_SIGNATURE,
          refreshSignature: REFRESH_ADMIN_TOKEN_SIGNATURE,
        };
        break;

      default:
        signature = {
          accessSignature: ACCESS_USER_TOKEN_SIGNATURE,
          refreshSignature: REFRESH_USER_TOKEN_SIGNATURE,
        };
        break;
    }
    return signature;
  }

  async getSignature({
    tokenType = tokenTypeEnum.ACCESS,
    role = RoleEnum.USER,
  }: {
    tokenType: tokenTypeEnum;
    role?: RoleEnum;
  }): Promise<string> {
    const signatures = await this.getTokenSignature({ role });
    return tokenType == tokenTypeEnum.ACCESS
      ? signatures.accessSignature
      : signatures.refreshSignature;
  }

  async decodeToken({
    authorization,
    tokenType = tokenTypeEnum.ACCESS,
  }: {
    authorization: string;
    tokenType?: tokenTypeEnum;
  }): Promise<{ user: HUser; payload: jWTpayloadtype }> {
    const decoded = jwt.decode(authorization) as jWTpayloadtype | null;
    // aud is stored as a string ("0" = user, "1" = admin)
    const role = Number(decoded?.aud?.[0]);
    if (!decoded || !(role in RoleEnum)) {
      throw new UnAuthorizedException("Invalid login credentials");
    }

    let payload: jWTpayloadtype;
    try {
      payload = await this.verifyToken({
        token: authorization,
        secret: await this.getSignature({
          tokenType,
          role,
        }),
      });
    } catch (error) {
      throw new UnAuthorizedException("Invalid or expired login credentials");
    }
    if (!payload?.sub) {
      throw new BadRequestException("missing token payload");
    }
    if (!payload.sid) {
      throw new UnAuthorizedException("Invalid login credentials");
    }
    // an access token only lives while its session exists, so logout takes effect immediately
    if (
      tokenType == tokenTypeEnum.ACCESS &&
      !(await this.cacheService.existCache({
        key: this.userSessionKey({ userId: payload.sub, sid: payload.sid }),
      }))
    ) {
      throw new UnAuthorizedException("Session has ended, please log in again");
    }
    const user = await this.userRepository.findById({
      id: toObjectId(payload.sub),
    });
    if (!user || !user.confirmEmail) {
      throw new NotFoundException("Invalid user id");
    }
    if ((user.changeCredentialsTime?.getTime() ?? 0) > payload.iat * 1000) {
      throw new UnAuthorizedException("Expired login credentials");
    }
    return { user, payload };
  }

  private async signCredentials({
    user,
    issuer,
    sid,
    refreshJti,
  }: {
    user: HUser;
    issuer: string;
    sid: string;
    refreshJti: string;
  }): Promise<{ access_token: string; refresh_token: string }> {
    const { accessSignature, refreshSignature } = await this.getTokenSignature({
      role: user.role,
    });
    const access_token = await this.generateToken({
      payload: { sub: user.id, sid },
      secret: accessSignature,
      options: {
        issuer,
        audience: [String(user.role)],
        expiresIn: ACCESS_TOKEN_EXPIRES_IN,
        jwtid: randomUUID(),
      },
    });
    const refresh_token = await this.generateToken({
      payload: { sub: user.id, sid },
      secret: refreshSignature,
      options: {
        audience: [String(user.role)],
        issuer,
        expiresIn: REFRESH_TOKEN_EXPIRES_IN,
        jwtid: refreshJti,
      },
    });
    return { access_token, refresh_token };
  }

  // login: opens a new session
  async createLoginCredentials({
    user,
    issuer,
  }: {
    user: HUser;
    issuer: string;
  }): Promise<{ access_token: string; refresh_token: string }> {
    const sid = randomUUID();
    const refreshJti = randomUUID();
    await this.cacheService.setCache({
      key: this.userSessionKey({ userId: user.id, sid }),
      value: refreshJti,
      ttl: REFRESH_TOKEN_EXPIRES_IN,
    });
    return this.signCredentials({ user, issuer, sid, refreshJti });
  }

  // refresh: swaps the refresh jti of the same session. Using an old refresh token again means it leaked, so the session is closed
  async rotateCredentials({
    payload,
    user,
    issuer,
  }: {
    payload: jWTpayloadtype;
    user: HUser;
    issuer: string;
  }): Promise<{ access_token: string; refresh_token: string }> {
    const refreshJti = randomUUID();
    const key = this.userSessionKey({ userId: payload.sub, sid: payload.sid });
    const previous = await this.cacheService.swapCache({
      key,
      value: refreshJti,
      ttl: REFRESH_TOKEN_EXPIRES_IN,
    });
    if (!previous) {
      throw new UnAuthorizedException("Session has ended, please log in again");
    }
    if (previous !== payload.jti) {
      await this.cacheService.deleteCache({ key });
      throw new UnAuthorizedException("Refresh token was already used, session closed");
    }
    return this.signCredentials({ user, issuer, sid: payload.sid, refreshJti });
  }

  // logout from this device
  async revokeSession({ payload }: { payload: jWTpayloadtype }) {
    await this.cacheService.deleteCache({
      key: this.userSessionKey({ userId: payload.sub, sid: payload.sid }),
    });
  }

  // logout from every device (optionally keeping the current one)
  async revokeAllSessions({ userId, exceptSid }: { userId: UserIdType; exceptSid?: string }) {
    const keys = await this.cacheService.keysCache({
      prefix: this.userBaseSessionKey({ userId }),
    });
    const keep = exceptSid ? this.userSessionKey({ userId, sid: exceptSid }) : undefined;
    await this.cacheService.deleteCache({ key: keys.filter((key) => key !== keep) });
  }

  // Basic auth (email:password) - only used when a route opts in
  async basicAuth({ email, password }: { email: string; password: string }) {
    const account = await this.userRepository.findOne({
      filter: { email, provider: ProviderEnum.SYSTEM },
      projection: "+password",
    });
    if (!account || !account.confirmEmail) throw new UnAuthorizedException("Invalid email or password");
    const match = await compare(password, account.password);
    if (!match) throw new UnAuthorizedException("Invalid email or password");

    return account;
  }
}

export const tokenService = new TokenService();
