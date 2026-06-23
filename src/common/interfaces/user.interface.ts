import { GenderEnum, ProviderEnum, RoleEnum } from "../enums";

export interface IUser {
  firstName: string;
  lastName: string;
  email: string;
  password?: string;
  phone?: string;
  fullName: string; // virtual

  DOB?: Date;
  emailConfirmedAt?: Date;
  emailVerifiedAt?: Date;
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