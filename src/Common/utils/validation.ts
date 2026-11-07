import { GenderEnum } from './../enum/user.enum';
import { languageEnum } from './../enum/security.enum';
import { z } from "zod";
import mongoose from "mongoose";

const matchFields = ({ original, copy, data, ctx, lang }:{ original:string, copy:string, data:any, ctx:z.RefinementCtx, lang:languageEnum }) => {
  if (data[original] != data[copy]) {
    ctx.addIssue({
      code: "custom",
      path: [copy],
      message:
        lang == languageEnum.AR
          ? `عفوا ${copy} لا يطابق ${original}`
          : `fail to match ${original} with ${copy}`,
    });
  }
};

export const generalValidationFields = {
  email:(lang:languageEnum)=> z.email({
    message: "please enter a valid email like : example@domain.com",
  }),
  password:(lang:languageEnum) => z
    .string()
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
      {
        message:
          lang === languageEnum.AR
            ? "كلمة المرور يجب أن تحتوي على حرف كبير وصغير ورقم ورمز خاص (@$!%*?&) و8 أحرف على الأقل"
            : "password must contain upper and lower case letters, a number and one of @$!%*?& (min 8 characters)",
      },
    )
    .min(8)
    .max(16),
  username: (lang:languageEnum) =>
    z
      .string()
      .trim()
      .min(2, {
        message:
          lang === languageEnum.AR
            ? "عفوا لا يمكن أن يكون اسم المستخدم أقل من 2 أحرف"
            : "username must be at least 2 characters long",
      })
      .max(51, { message: "username must be at most 51 characters long" }),
  phone:(lang:languageEnum) => z.e164(),
  confirmPassword:(lang:languageEnum) => z.string().min(8).max(16),
  gender:(lang:languageEnum) => z.enum(GenderEnum),
  bio:(lang:languageEnum) => z.string().trim().max(160),
  otp: (lang:languageEnum) => z.string().regex(/^\d{6}$/, { error: "invalid code" }),
  id: (lang:languageEnum) =>
    z.string().refine(
      (data) => {
        return mongoose.Types.ObjectId.isValid(data);
      },
      { message: "Invalid format " },
    ),
  page: () => z.coerce.number().int().min(1).default(1),
  limit: () => z.coerce.number().int().min(1).max(50).default(10),
  file: (lang:languageEnum) =>
    z.strictObject({
      fieldname: z.string(),
      originalname: z.string(),
      encoding: z.string(),
      mimetype: z.string(),
      buffer: z.instanceof(Buffer),
      size: z.number(),
      path: z.string(),
    }),

  matchFields,
};
