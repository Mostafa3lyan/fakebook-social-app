import { randomInt } from "node:crypto";

export const createOtp = async (): Promise<number> => {
  return randomInt(100000, 1000000);
};
