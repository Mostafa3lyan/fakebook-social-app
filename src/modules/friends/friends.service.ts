import { HydratedDocument, Types } from "mongoose";
import { FriendRequestStatusEnum } from "../../common/enums";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "../../common/exceptions";
import { IPagination, IUser } from "../../common/interfaces";
import { notificationsService, NotificationsService } from "../../common/services";
import { PaginationDto } from "../../common/validation";
import { FriendRequestRepository, UserRepository } from "../../DB/repository";

export class FriendsService {
  private readonly friendRequestRepository: FriendRequestRepository;
  private readonly userRepository: UserRepository;
  private readonly notificationsService: NotificationsService;

  constructor(
    friendRequestRepository: FriendRequestRepository = new FriendRequestRepository(),
    userRepository: UserRepository = new UserRepository(),
    notifications: NotificationsService = notificationsService,
  ) {
    this.friendRequestRepository = friendRequestRepository;
    this.userRepository = userRepository;
    this.notificationsService = notifications;
  }

  // Send friend request
  public async sendFriendRequest(sender: HydratedDocument<IUser>, receiverId: string) {
    if (sender._id.toString() === receiverId) {
      throw new BadRequestException("You cannot send a friend request to yourself");
    }

    const receiver = await this.userRepository.findById({ id: receiverId });
    if (!receiver) {
      throw new NotFoundException("User not found");
    }

    const senderFriendIds = (sender.friends || []).map((f) =>
      typeof f === "object" && "_id" in f ? (f as any)._id.toString() : f.toString(),
    );
    if (senderFriendIds.includes(receiverId)) {
      throw new ConflictException("You are already friends with this user");
    }

    const senderBlocked = (sender.blockedUsers || []).map(String);
    const receiverBlocked = (receiver.blockedUsers || []).map(String);
    if (senderBlocked.includes(receiverId) || receiverBlocked.includes(sender._id.toString())) {
      throw new ForbiddenException("Cannot send friend request to this user");
    }

    const existingRequest = await this.friendRequestRepository.findOne({
      filter: {
        $or: [
          { sender: sender._id, receiver: receiverId },
          { sender: receiverId, receiver: sender._id },
        ],
        status: FriendRequestStatusEnum.PENDING,
      },
    });

    if (existingRequest) {
      if (existingRequest.sender.toString() === sender._id.toString()) {
        throw new ConflictException("Friend request has already been sent to this user");
      } else {
        throw new ConflictException("This user has already sent you a friend request");
      }
    }

    const request = await this.friendRequestRepository.createOne({
      data: {
        sender: sender._id,
        receiver: new Types.ObjectId(receiverId),
        status: FriendRequestStatusEnum.PENDING,
      },
    });

    // Notify receiver (best-effort)
    try {
      await this.notificationsService.notifyNewMessage({
        recipientId: receiverId,
        message: `${sender.firstName} ${sender.lastName} sent you a friend request`,
      });
    } catch (err) {
      console.error("Failed to notify user about friend request:", err);
    }

    return request;
  }

  // Accept incoming friend request
  public async acceptFriendRequest(user: HydratedDocument<IUser>, requestId: string) {
    const request = await this.friendRequestRepository.findById({
      id: requestId,
      options: { lean: false },
    });

    if (!request) {
      throw new NotFoundException("Friend request not found");
    }

    if (request.receiver.toString() !== user._id.toString()) {
      throw new ForbiddenException("You are not authorized to accept this friend request");
    }

    if (request.status !== FriendRequestStatusEnum.PENDING) {
      throw new BadRequestException(`Friend request is already ${request.status}`);
    }

    const senderId = request.sender.toString();
    const sender = await this.userRepository.findById({ id: senderId });
    if (!sender) {
      throw new NotFoundException("Sender account no longer exists");
    }

    const userBlocked = (user.blockedUsers || []).map(String);
    const senderBlocked = (sender.blockedUsers || []).map(String);
    if (userBlocked.includes(senderId) || senderBlocked.includes(user._id.toString())) {
      throw new ForbiddenException("Cannot accept friend request from a blocked user");
    }

    // Mutually add to friends array using $addToSet to avoid duplicates
    await this.userRepository.updateOne({
      filter: { _id: user._id },
      update: { $addToSet: { friends: new Types.ObjectId(senderId) } },
    });

    await this.userRepository.updateOne({
      filter: { _id: senderId },
      update: { $addToSet: { friends: user._id } },
    });

    // Option A: Delete the request document on accept so future state remains clean
    await this.friendRequestRepository.deleteOne({
      filter: { _id: requestId },
    });

    // Notify sender that request was accepted (best-effort)
    try {
      await this.notificationsService.notifyNewMessage({
        recipientId: senderId,
        message: `${user.firstName} ${user.lastName} accepted your friend request`,
      });
    } catch (err) {
      console.error("Failed to notify user about accepted friend request:", err);
    }

    return { message: "Friend request accepted successfully" };
  }

  // Reject incoming friend request
  public async rejectFriendRequest(user: HydratedDocument<IUser>, requestId: string) {
    const request = await this.friendRequestRepository.findById({ id: requestId });
    if (!request) {
      throw new NotFoundException("Friend request not found");
    }

    if (request.receiver.toString() !== user._id.toString()) {
      throw new ForbiddenException("You are not authorized to reject this friend request");
    }

    // Option A: Delete the request document
    await this.friendRequestRepository.deleteOne({
      filter: { _id: requestId },
    });

    return { message: "Friend request rejected successfully" };
  }

  // Cancel outgoing friend request
  public async cancelFriendRequest(user: HydratedDocument<IUser>, requestId: string) {
    const request = await this.friendRequestRepository.findById({ id: requestId });
    if (!request) {
      throw new NotFoundException("Friend request not found");
    }

    if (request.sender.toString() !== user._id.toString()) {
      throw new ForbiddenException("You are not authorized to cancel this friend request");
    }

    // Option A: Delete the request document
    await this.friendRequestRepository.deleteOne({
      filter: { _id: requestId },
    });

    return { message: "Friend request cancelled successfully" };
  }

  // Remove an existing friend
  public async removeFriend(user: HydratedDocument<IUser>, friendId: string) {
    const userFriendIds = (user.friends || []).map((f) =>
      typeof f === "object" && "_id" in f ? (f as any)._id.toString() : f.toString(),
    );

    if (!userFriendIds.includes(friendId)) {
      throw new BadRequestException("User is not in your friends list");
    }

    // Mutually remove from both friends arrays
    await this.userRepository.updateOne({
      filter: { _id: user._id },
      update: { $pull: { friends: new Types.ObjectId(friendId) } },
    });

    await this.userRepository.updateOne({
      filter: { _id: friendId },
      update: { $pull: { friends: user._id } },
    });

    return { message: "Friend removed successfully" };
  }

  // List friends for a user with pagination
  public async getFriends(
    targetUserId: string,
    { page = 1, limit = 10, search }: PaginationDto,
  ): Promise<IPagination<IUser>> {
    const account = await this.userRepository.findById({
      id: targetUserId,
      projection: "friends",
      populate: {
        path: "friends",
        select: "firstName lastName profilePicture",
        match: { deletedAt: { $exists: false } },
      },
    });

    if (!account) {
      throw new NotFoundException("User not found");
    }

    let allFriends = ((account.friends || []) as unknown as IUser[]).filter(Boolean);

    if (search) {
      const q = search.toLowerCase();
      allFriends = allFriends.filter(
        (f) =>
          f.firstName?.toLowerCase().includes(q) ||
          f.lastName?.toLowerCase().includes(q),
      );
    }

    const totalCount = allFriends.length;
    const startIndex = (page - 1) * limit;
    const paginatedFriends = allFriends.slice(startIndex, startIndex + limit);

    const totalPages = Math.ceil(totalCount / limit) || 1;
    return {
      total: totalCount,
      totalPages,
      page,
      limit,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      data: paginatedFriends,
    };
  }

  // List incoming pending requests
  public async getIncomingRequests(
    user: HydratedDocument<IUser>,
    { page = 1, limit = 10 }: PaginationDto,
  ) {
    return this.friendRequestRepository.paginate({
      filter: {
        receiver: user._id,
        status: FriendRequestStatusEnum.PENDING,
      },
      populate: {
        path: "sender",
        select: "firstName lastName profilePicture",
        match: { deletedAt: { $exists: false } },
      },
      page,
      limit,
      sort: { createdAt: -1 },
    });
  }

  // List outgoing pending requests
  public async getOutgoingRequests(
    user: HydratedDocument<IUser>,
    { page = 1, limit = 10 }: PaginationDto,
  ) {
    return this.friendRequestRepository.paginate({
      filter: {
        sender: user._id,
        status: FriendRequestStatusEnum.PENDING,
      },
      populate: {
        path: "receiver",
        select: "firstName lastName profilePicture",
        match: { deletedAt: { $exists: false } },
      },
      page,
      limit,
      sort: { createdAt: -1 },
    });
  }

  // Get relationship status between logged-in user and target user
  public async getRelationshipStatus(user: HydratedDocument<IUser>, targetUserId: string) {
    if (user._id.toString() === targetUserId) {
      return { status: "self" };
    }

    const friendIds = (user.friends || []).map((f) =>
      typeof f === "object" && "_id" in f ? (f as any)._id.toString() : f.toString(),
    );

    if (friendIds.includes(targetUserId)) {
      return { status: "friends" };
    }

    const outgoing = await this.friendRequestRepository.findOne({
      filter: {
        sender: user._id,
        receiver: targetUserId,
        status: FriendRequestStatusEnum.PENDING,
      },
    });

    if (outgoing) {
      return { status: "pending_sent", requestId: outgoing._id };
    }

    const incoming = await this.friendRequestRepository.findOne({
      filter: {
        sender: targetUserId,
        receiver: user._id,
        status: FriendRequestStatusEnum.PENDING,
      },
    });

    if (incoming) {
      return { status: "pending_received", requestId: incoming._id };
    }

    return { status: "none" };
  }
}

export const friendsService = new FriendsService();
