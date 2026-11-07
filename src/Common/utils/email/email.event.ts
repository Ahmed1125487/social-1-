import { EmailSubjectEnum } from "./../../enum/email.enum";
import { EventEmitter } from "node:events";
import { sendEmail } from "./send.email";
import { verifyEmailTemplate } from "./email.templates";
import { APP_EMAIL, NODE_ENV } from "./../../../config";

export const emailEvent = new EventEmitter();

emailEvent.on(
  "sendEmail",
  async ({
    recipients,
    subject = EmailSubjectEnum.CONFIRM_EMAIL,
    data,
  }: {
    subject?: EmailSubjectEnum;
    recipients: { to?: string | string[]; cc?: string | string[]; bcc?: string | string[] };
    data: any;
  }) => {
    try {
      // development without a mail account: print the code instead of emailing it
      if (!APP_EMAIL && NODE_ENV !== "production") {
        console.log(`[dev email] ${subject} -> ${recipients.to} | code: ${data.code}`);
        return;
      }
      await sendEmail({
        ...recipients,
        subject,
        html: verifyEmailTemplate({
          code: data.code,
          subject,
          title: data.title ?? subject,
        }),
      });
    } catch (error) {
      console.log(error);
    }
  },
);
