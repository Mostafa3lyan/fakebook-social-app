
export interface ILoginResponse {
  access_token: string;
  refresh_token: string;
  twoFactorRequired?: boolean;}

export interface ISignupResponse extends ILoginResponse {
  fullName: string;
}