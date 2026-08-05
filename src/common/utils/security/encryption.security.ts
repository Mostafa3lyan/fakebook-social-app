import crypto from "node:crypto";
import { ENC_SECRET_KEY, Encryption_ALGORITHM, IV_LENGTH } from "../../../config/config.service";


export const encryptGenerator = ({ plainText }: { plainText: string }): string => {
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(Encryption_ALGORITHM, ENC_SECRET_KEY, iv);

  const cipherText = Buffer.concat([
    cipher.update(plainText, "utf-8"),
    cipher.final(),
  ]).toString("hex");

  return `${iv.toString("hex")}:${cipherText}`;
};

export const decryptGenerator = ({
  encryptedText,
}: {
  encryptedText: string;
}): string => {
  const [ivHex, cipherText] = encryptedText.split(":");

  if (!ivHex || !cipherText) {
    throw new Error("Invalid encrypted text format — expected 'iv:cipherText'");
  }

  const decipher = crypto.createDecipheriv(
    Encryption_ALGORITHM,
    ENC_SECRET_KEY,
    Buffer.from(ivHex, "hex"),
  );

  return Buffer.concat([
    decipher.update(Buffer.from(cipherText, "hex")),
    decipher.final(),
  ]).toString("utf-8");
};