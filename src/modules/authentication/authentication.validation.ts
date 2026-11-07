import { generalValidationFields } from "./../../Common/utils/validation";
import { languageEnum } from "./../../Common/enum";
import { z } from "zod";

const loginSchema = (lang: languageEnum) =>
  z.object({
    email: generalValidationFields.email(lang),
    password: generalValidationFields.password(lang),
  });

export const login = (lang: languageEnum) =>
  z.object({
    body: loginSchema(lang),
    query: z.strictObject({
      lang: z.enum(["en", "ar"]).default("en"),
      darkMode: z.stringbool().default(false),
    }),
  });

export const signup = (lang: languageEnum) => {
  return z.object({
    body: loginSchema(lang)
      .safeExtend({
        username: generalValidationFields.username(lang),
        phone: generalValidationFields.phone(lang).optional(),
        gender: generalValidationFields.gender(lang).optional(),
        confirmPassword: generalValidationFields.password(lang),
      })
      .superRefine((data, ctx) => {
        generalValidationFields.matchFields({
          original: "password",
          copy: "confirmPassword",
          data,
          ctx,
          lang,
        });
      }),
  });
};

export const signupWithGmail = (lang: languageEnum) => {
  return z.object({
    body: z.strictObject({
      idToken: z.string().min(10),
    }),
  });
};

export const confirmEmail = (lang: languageEnum) => {
  return z.object({
    body: z.strictObject({
      email: generalValidationFields.email(lang),
      otp: generalValidationFields.otp(lang),
    }),
  });
};

export const resendConfirmEmail = (lang: languageEnum) => {
  return z.object({
    body: z.strictObject({
      email: generalValidationFields.email(lang),
    }),
  });
};

export const forgotPassword = (lang: languageEnum) => {
  return z.object({
    body: z.strictObject({
      email: generalValidationFields.email(lang),
    }),
  });
};

export const resetForgotPassword = (lang: languageEnum) => {
  return z.object({
    body: z
      .strictObject({
        email: generalValidationFields.email(lang),
        otp: generalValidationFields.otp(lang),
        password: generalValidationFields.password(lang),
        confirmPassword: generalValidationFields.password(lang),
      })
      .superRefine((data, ctx) => {
        generalValidationFields.matchFields({
          original: "password",
          copy: "confirmPassword",
          data,
          ctx,
          lang,
        });
      }),
  });
};
