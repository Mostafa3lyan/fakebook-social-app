import bcrypt from "bcrypt";
import argon2 from "argon2";
import { SALT_ROUND } from "../../../config/config.service.js";
import { HashApproachEnum } from "../../enums/security.enum.js";

export class HashService {
  async generateHash({
    plainText,
    salt = SALT_ROUND,
    approach = HashApproachEnum.bcrypt,
  }: {
    plainText: string;
    salt?: number;
    approach?: HashApproachEnum;
  }) {
    let hashValue: string;

    switch (approach) {
      case HashApproachEnum.argon2:
        hashValue = await argon2.hash(plainText);
        break;

      case HashApproachEnum.bcrypt:
      default:
        hashValue = await bcrypt.hash(plainText, salt);
        break;
    }

    return hashValue;
  }

  async compareHash({
    plainText,
    cipherText,
    approach = HashApproachEnum.bcrypt,
  }: {
    plainText: string;
    cipherText: string;
    approach?: HashApproachEnum;
  }) {
    let match = false;

    switch (approach) {
      case HashApproachEnum.argon2:
        match = await argon2.verify(cipherText, plainText);
        break;

      case HashApproachEnum.bcrypt:
      default:
        match = await bcrypt.compare(plainText, cipherText);
        break;
    }

    return match;
  }
}

export const hashService = new HashService();
export const generateHash = hashService.generateHash.bind(hashService);
export const compareHash = hashService.compareHash.bind(hashService);
