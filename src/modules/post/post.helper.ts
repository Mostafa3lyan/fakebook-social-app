import { HydratedDocument, Types } from "mongoose";
import { PostVisibilityEnum } from "../../common/enums";
import { IUser } from "../../common/interfaces";
import { NotFoundException } from "../../common/exceptions";
import { notificationsService, NotificationsService, s3Service, S3Service } from "../../common/services";
import { UserRepository } from "../../DB/repository/user.repository";

export const AUTHOR_POPULATE = [{ path: "createdBy", select: "firstName lastName profilePicture" }];

export const getVisibility = (user: HydratedDocument<IUser>) => {
  return [
    { visibility: PostVisibilityEnum.PUBLIC },
    { visibility: PostVisibilityEnum.ONLY_ME, createdBy: user._id },
    { visibility: PostVisibilityEnum.FRIENDS, createdBy: { $in: [user._id, ...(user.friends || [])] } },
    { tags: { $in: [user._id] } },
  ];
};

export class PostHelper {
  private readonly userRepository: UserRepository;
  private readonly notificationsService: NotificationsService;
  private readonly s3Service: S3Service;

  constructor(
    userRepository: UserRepository = new UserRepository(),
    notifications: NotificationsService = notificationsService,
    s3: S3Service = s3Service,
  ) {
    this.userRepository = userRepository;
    this.notificationsService = notifications;
    this.s3Service = s3;
  }

  /** Dedupe tagged IDs and ensure every tagged user exists. */
  public async resolveMentions(tags: Types.ObjectId[]): Promise<Types.ObjectId[]> {
    const unique = [...new Map(tags.map((id) => [id.toString(), id])).values()];
    if (!unique.length) return [];

    const accounts = await this.userRepository.find({
      filter: { _id: { $in: unique } },
      options: { lean: true },
    });
    if (accounts.length !== unique.length) {
      throw new NotFoundException("One or more tagged users not found");
    }

    return unique;
  }

  /** Notify users who were not previously tagged. */
  public async notifyNewlyTagged(
    previous: Types.ObjectId[] | undefined,
    next: Types.ObjectId[] | undefined,
    actor: HydratedDocument<IUser>,
    target: "post" | "comment" = "post",
  ) {
    if (!next?.length) return;

    const existing = new Set((previous ?? []).map(String));
    const newlyTagged = next.filter((id) => !existing.has(id.toString()));

    await Promise.allSettled(
      newlyTagged.map((id) =>
        this.notificationsService.notifyNewMessage({
          recipientId: id.toString(),
          message: `${actor.firstName} ${actor.lastName} tagged you in a ${target}`,
        }),
      ),
    );
  }

  /** Best-effort S3 cleanup (never fails the request). */
  public async safeDeleteAssets(keys: string[]) {
    if (!keys.length) return;
    try {
      await this.s3Service.deleteMultipleAssets({ keys });
    } catch (err) {
      console.error("Failed to delete S3 assets:", keys, err);
    }
  }
}

export const postHelper = new PostHelper();
