import crypto from "node:crypto";
import { ENC_KEY, IV_LENGTH } from "../../config.js";

// AES-256-GCM: the auth tag makes tampering detectable. Stored as iv::tag::data (hex)
export const encryption = async (plaintext: string): Promise<string> => {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-gcm", ENC_KEY, iv);
  const encryptedData = Buffer.concat([cipher.update(plaintext, "utf-8"), cipher.final()]);
  return `${iv.toString("hex")}::${cipher.getAuthTag().toString("hex")}::${encryptedData.toString("hex")}`;
};

export const decryption = async (encryptedData: string): Promise<string> => {
  const [iv, tag, encryptedText] = encryptedData.split("::") as [string, string, string];
  const decipher = crypto.createDecipheriv("aes-256-gcm", ENC_KEY, Buffer.from(iv, "hex"));
  decipher.setAuthTag(Buffer.from(tag, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedText, "hex")), decipher.final()]).toString("utf-8");
};
