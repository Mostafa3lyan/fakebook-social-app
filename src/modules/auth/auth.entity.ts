
export interface ILoginResponse {
  email: string;
  password: string;
}

export interface ISignupResponse extends ILoginResponse {
  fullName: string;
}