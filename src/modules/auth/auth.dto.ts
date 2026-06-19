
export interface LoginDto {
  email: string;
  password: string;
}

export interface SignupDto extends LoginDto {
  fullName: string;
}