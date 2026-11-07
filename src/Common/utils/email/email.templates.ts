import { EmailSubjectEnum } from "../../enum/email.enum.js";

const otpTemplate = ({ code, title }: { code: string; title: string }): string => `
<div style="font-family:Arial,sans-serif;max-width:420px;margin:auto;padding:24px;border:1px solid #e5e5e5;border-radius:8px">
  <h2 style="margin:0 0 12px">${title}</h2>
  <p style="color:#444">Use this code, it expires in 2 minutes.</p>
  <p style="font-size:32px;letter-spacing:6px;font-weight:bold;margin:16px 0">${code}</p>
  <p style="color:#888;font-size:12px">If you didn't ask for this, ignore this email.</p>
</div>`;

export const templates = {
  [EmailSubjectEnum.CONFIRM_EMAIL]: (data: any) => otpTemplate(data),
  [EmailSubjectEnum.FORGET_PASSWORD]: (data: any) => otpTemplate(data),
};

export const verifyEmailTemplate = <T = any>(data: T & { subject: EmailSubjectEnum }) => {
  return templates[data.subject](data);
};
