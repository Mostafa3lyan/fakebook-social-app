import { GenderEnum, ProviderEnum, RoleEnum } from "../enums";

// `exactOptionalPropertyTypes` is enabled, so `field?: T` forbids assigning
// `undefined`. Fields the services clear at runtime need an explicit
// `| undefined` — do not "simplify" those away.

/** The raw document shape as stored in MongoDB. Virtuals live in `IUserVirtuals`. */
export interface IUser {
  firstName: string;
  lastName: string;
  email: string;
  password?: string;
  phone?: string;

  dateOfBirth?: Date;

  /** Set when the signup OTP is confirmed — the account is usable from here on. */
  emailConfirmedAt?: Date;
  /** Set when a forgot-password OTP or magic link is verified. Cleared once used. */
  resetVerifiedAt?: Date | undefined;
  /** Tokens issued before this moment are rejected. */
  changeCredentialsTime?: Date;

  deletedAt?: Date;
  restoredAt?: Date;

  profilePicture?: string | undefined;
  profileCoverPictures?: string[];
  oldPasswords?: string[];

  profileVisits?: number | undefined;

  /** Required for system signups, absent for Google accounts. */
  gender?: GenderEnum;
  provider: ProviderEnum;
  role: RoleEnum;

  twoFactorVerified: boolean;
}

/** Computed fields — present on hydrated documents, never persisted. */
export interface IUserVirtuals {
  fullName: string;
}
