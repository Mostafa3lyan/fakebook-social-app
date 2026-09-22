import { IPost } from "../../common/interfaces";
import { PostModel } from "../models";
import { DatabaseRepository } from "./base.repository";


export class PostRepository extends DatabaseRepository<IPost> {
  constructor() {
    super(PostModel);
  }
}