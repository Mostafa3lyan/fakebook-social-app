import { BadRequestException } from '../../common/exceptions';
import { IUser } from '../../common/interfaces';
import { UserRepository } from './../../DB/repository/user.repository';
import { SignupDto } from './auth.dto';
import { LoginDto } from "./auth.validation";

class AuthenticationService {
  private UserRepository: UserRepository;

  constructor() {
    this.UserRepository = new UserRepository();
  }


  login = (data: LoginDto): LoginDto => {
    return data;
  }

  signup = async (data: SignupDto): Promise<IUser> => {
    const [user] = await this.UserRepository.create({data : [data]});
    if (!user) {
      throw new BadRequestException("User not created");
    }
    
    return user.toJSON();

  }

}

export default new AuthenticationService;