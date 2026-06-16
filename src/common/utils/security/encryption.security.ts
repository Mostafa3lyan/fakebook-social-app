import crypto from "node:crypto";
import {
  ENC_SECRET_KEY,
  Encryption_ALGORITHM,
  IV_LENGTH,
} from "../../../../config/config.service.js";

export class EncryptionService {
  generateEncryption({ plainText }: { plainText: string }) {
    const iv = crypto.randomBytes(IV_LENGTH);

    const cipherIv = crypto.createCipheriv(
      Encryption_ALGORITHM,
      ENC_SECRET_KEY,
      iv,
    );
    let cipherText = cipherIv.update(plainText, "utf-8", "hex");
    cipherText += cipherIv.final("hex");
    return `${iv.toString("hex")}:${cipherText}`;
  }

  generateDecryption(encryptedText: string) {
    const [iv, cipherText] = encryptedText.split(":") || [];

    const decipherIv = crypto.createDecipheriv(
      Encryption_ALGORITHM,
      ENC_SECRET_KEY,
      Buffer.from(iv, "hex"),
    );

    let plainText = decipherIv.update(cipherText, "hex", "utf-8");
    plainText += decipherIv.final("utf-8");

    return plainText;
  }
}

export const encryptionService = new EncryptionService();
export const generateEncryption = encryptionService.generateEncryption.bind(encryptionService);
export const generateDecryption = encryptionService.generateDecryption.bind(encryptionService);
