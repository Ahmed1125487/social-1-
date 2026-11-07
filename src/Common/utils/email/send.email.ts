import { EmailSubjectEnum } from './../../enum/email.enum';
import { APP_EMAIL, APP_PASSWORD, APPLICATION_NAME } from "../../../config.js";

import nodemailer  from "nodemailer";
import { BadRequestException } from "../../exception/domain.exception.js";



export const userEmailKey= ({email, subject}:{email:string, subject:EmailSubjectEnum}):string=>{
  return  `User::${email}::${subject}::OTP`
}

export const userEmailTrailsKey= ({email, subject}:{email:string, subject:EmailSubjectEnum}):string=>{
  return  `${userEmailKey({email, subject})}::Trails`
}

export const userEmailAttemptsKey= ({email, subject}:{email:string, subject:EmailSubjectEnum}):string=>{
  return  `${userEmailKey({email, subject})}::Attempts`
}

// no mail account configured (development): the event handler prints the code instead
const transporter = APP_EMAIL
  ? nodemailer.createTransport({ service: "gmail", auth: { user: APP_EMAIL, pass: APP_PASSWORD } })
  : null;

export const sendEmail = async ({
  to,
  subject,
  cc,
  bcc,
  text,
  html,
  attachments = [],
}: {
  to?: string | string[];
  subject: string;
  cc?: string | string[];
  bcc?: string | string[];
  text?: string;
  html?: string;
  attachments?: any[];
}) => {
  if (!transporter) return;
  if (!to?.length && !bcc?.length && !cc?.length) {
    throw new BadRequestException("missing email recipients");
  }
  if (!html?.length && !text?.length && !attachments?.length) {
    throw new BadRequestException("missing email content");
  }
  // a failure here is logged by the email event handler, it must not crash the request
  await transporter.sendMail({
    from: `${APPLICATION_NAME} <${APP_EMAIL}>`,
    to,
    subject,
    cc,
    bcc,
    text,
    html,
    attachments,
  });
};
