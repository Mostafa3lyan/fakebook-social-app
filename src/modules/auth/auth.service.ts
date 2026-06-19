import { LoginDto, SignupDto } from "./auth.dto";

class AuthenticationService {

  constructor() { }


  login = (data: LoginDto): LoginDto => {
    return data;
  }

  signup = (data: SignupDto): SignupDto => {
    return data;
  }

}

export default new AuthenticationService;