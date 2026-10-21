import { IFriendRequest } from "../../common/interfaces";
import { FriendRequestModel } from "../models/friend-request.model";
import { DatabaseRepository } from "./base.repository";

export class FriendRequestRepository extends DatabaseRepository<IFriendRequest> {
  constructor() {
    super(FriendRequestModel);
  }
}
