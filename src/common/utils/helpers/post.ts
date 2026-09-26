import { HydratedDocument } from "mongoose"
import { PostVisibilityEnum } from "../../enums"
import { IUser } from "../../interfaces"

export const getVisibility = (user: HydratedDocument<IUser>) => {
  return [
    { visibility: PostVisibilityEnum.PUBLIC },
    { visibility: PostVisibilityEnum.ONLY_ME, createdBy: user._id },
    { visibility: PostVisibilityEnum.FRIENDS, createdBy: { $in: [user._id, ...(user.friends || [])] } },
    { tags: { $in: [user._id] } }
  ]
}