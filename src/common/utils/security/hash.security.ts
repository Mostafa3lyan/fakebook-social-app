import bcrypt from "bcrypt";
import argon2 from "argon2";
import { SALT_ROUND } from "../../../config/config.service";
import { HashApproachEnum } from "../../enums";

export const generateHash = async ({
  plainText,
  approach = HashApproachEnum.bcrypt,
  argon2Options,
}: {
  plainText: string;
  approach?: HashApproachEnum;
  argon2Options?: argon2.Options;
}): Promise<string> => {
  switch (approach) {
    case HashApproachEnum.argon2:
      return argon2.hash(plainText, argon2Options);

    case HashApproachEnum.bcrypt:
      return bcrypt.hash(plainText, SALT_ROUND);

    default:
      throw new Error(`Unsupported hash approach: ${approach}`);
  }
};

export const compareHash = async ({
  plainText,
  cipherText,
  approach = HashApproachEnum.bcrypt,
}: {
  plainText: string;
  cipherText: string;
  approach?: HashApproachEnum;
}): Promise<boolean> => {
  switch (approach) {
    case HashApproachEnum.argon2:
      // argon2.verify expects (hash, plain) — opposite of bcrypt
      return argon2.verify(cipherText, plainText);

    case HashApproachEnum.bcrypt:
      return bcrypt.compare(plainText, cipherText);

    default:
      throw new Error(`Unsupported hash approach: ${approach}`);
  }
};