import { generalValidationFields } from "./../../Common/utils/validation";
import { languageEnum, logoutEnum } from "./../../Common/enum";
import { z } from "zod";

export const logout = (lang: languageEnum) =>
  z.object({
    body: z.strictObject({
      action: z.enum(logoutEnum).default(logoutEnum.DEVICE),
    }),
  });

export const updateProfile = (lang: languageEnum) =>
  z.object({
    body: z
      .strictObject({
        username: generalValidationFields.username(lang),
        bio: generalValidationFields.bio(lang),
        phone: generalValidationFields.phone(lang),
        gender: generalValidationFields.gender(lang),
        DOB: z.coerce.date().max(new Date(), { message: "DOB can't be in the future" }),
      })
      .partial()
      .refine((data) => Object.keys(data).length > 0, {
        message: "nothing to update",
      }),
  });

export const privacy = (lang: languageEnum) =>
  z.object({
    body: z.strictObject({
      isPrivate: z.boolean(),
    }),
  });

export const changePassword = (lang: languageEnum) =>
  z.object({
    body: z
      .strictObject({
        currentPassword: z.string().min(1),
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

export const idParam = (lang: languageEnum) =>
  z.object({
    params: z.strictObject({
      id: generalValidationFields.id(lang),
    }),
  });

export const pagination = (lang: languageEnum) =>
  z.object({
    query: z.object({
      page: generalValidationFields.page(),
      limit: generalValidationFields.limit(),
    }),
  });

export const pagedIdParam = (lang: languageEnum) =>
  z.object({
    params: z.strictObject({
      id: generalValidationFields.id(lang),
    }),
    query: z.object({
      page: generalValidationFields.page(),
      limit: generalValidationFields.limit(),
    }),
  });

export const search = (lang: languageEnum) =>
  z.object({
    query: z.object({
      q: z.string().trim().min(2).max(50),
      page: generalValidationFields.page(),
      limit: generalValidationFields.limit(),
    }),
  });

export const suggestions = (lang: languageEnum) =>
  z.object({
    query: z.object({
      limit: generalValidationFields.limit(),
    }),
  });
