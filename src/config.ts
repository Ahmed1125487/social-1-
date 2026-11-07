import { resolve } from "node:path";
import { config } from "dotenv";

export const NODE_ENV: string = process.env.NODE_ENV ?? "development";
config({
  path: resolve(`.env.${NODE_ENV}`),
});

export const PORT: number = parseInt(process.env.PORT ?? "9000");
export const RATE_LIMIT_MAX: number = parseInt(process.env.RATE_LIMIT_MAX ?? "30");
export const SALT: number = parseInt(process.env.SALT ?? "12");

export const DB_URI: string = process.env.DB_URI as string;
export const REDIS_URI: string = process.env.REDIS_URI as string;
export const ENC_KEY: string = process.env.ENC_KEY as string;
export const IV_LENGTH: number = parseInt(
  process.env.IV_LENGTH ?? process.env.IV_LEGTH ?? "16",
) as number;

export const ACCESS_USER_TOKEN_SIGNATURE: string = process.env
  .ACCESS_USER_TOKEN_SIGNATURE as string;
export const ACCESS_ADMIN_TOKEN_SIGNATURE: string = process.env
  .ACCESS_ADMIN_TOKEN_SIGNATURE as string;
export const ACCESS_TOKEN_EXPIRES_IN: number = parseInt(
  process.env.ACCESS_TOKEN_EXPIRES_IN ?? "1800",
) as number;

export const REFRESH_USER_TOKEN_SIGNATURE: string = process.env
  .REFRESH_USER_TOKEN_SIGNATURE as string;
export const REFRESH_ADMIN_TOKEN_SIGNATURE: string = process.env
  .REFRESH_ADMIN_TOKEN_SIGNATURE as string;
export const REFRESH_TOKEN_EXPIRES_IN: number = parseInt(
  process.env.REFRESH_TOKEN_EXPIRES_IN ?? "31536000",
) as number;

export const APP_EMAIL: string = process.env.APP_EMAIL as string;
export const APP_PASSWORD: string = process.env.APP_PASSWORD as string;
export const APPLICATION_NAME: string =
  (process.env.APPLICATION_NAME as string) ?? "SocialApp";

export const WEB_CLIENT_ID: string[] =
  process.env.WEB_CLIENT_ID?.split(",").map((id) => id.trim()) || [];
export const ORIGINS: string[] = process.env.ORIGINS?.split(",") || [];

// fail fast with a clear message instead of a confusing crash later
const required: Record<string, unknown> = {
  DB_URI,
  REDIS_URI,
  ENC_KEY,
  ACCESS_USER_TOKEN_SIGNATURE,
  ACCESS_ADMIN_TOKEN_SIGNATURE,
  REFRESH_USER_TOKEN_SIGNATURE,
  REFRESH_ADMIN_TOKEN_SIGNATURE,
};
const missing = Object.keys(required).filter((key) => !required[key]);
if (missing.length) {
  throw new Error(`Missing environment variables: ${missing.join(", ")}`);
}
if (Buffer.byteLength(ENC_KEY) !== 32) {
  throw new Error("ENC_KEY must be exactly 32 characters (AES-256)");
}
