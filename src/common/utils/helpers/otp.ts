export const createOtp = async (): Promise<number> => {
  return Math.floor(Math.random() * 900000 + 100000);
};
