import { IComment } from "../../common/interfaces";
import { CommentModel } from "../models";
import { DatabaseRepository } from "./base.repository";


export class CommentRepository extends DatabaseRepository<IComment> {
  constructor() {
    super(CommentModel);
  }
}