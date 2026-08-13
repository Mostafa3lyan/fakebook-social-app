import { GenderEnum, ProviderEnum, RoleEnum } from "../enums";

export interface IUser {
  firstName: string;
  lastName: string;
  email: string;
  password?: string;
  phone?: string;
  fullName: string; // virtual

  dateOfBirth?: Date;
  emailConfirmedAt?: Date;
  emailVerifiedAt?: Date | undefined;
  changeCredentialsTime?: Date;

  profilePicture?: string;
  profileCoverPictures?: string[];
  oldPasswords?: string[];

  profileVisits: number;

  gender: GenderEnum;
  provider: ProviderEnum;
  role: RoleEnum;

  twoFactorVerified: boolean;
}