import Knock from "@knocklabs/node";
import { HydratedDocument } from "mongoose";
import { IUser } from "../../common/interfaces";
import { KNOCK_API_KEY, KNOCK_FCM_CHANNEL_ID } from "../../config/config.service";
import { NotFoundException } from "../../common/exceptions";

interface TriggerWorkflowParams {
  workflowKey: string;
  recipients: string[];
  data: Record<string, unknown>;
}

// interface SetChannelDataParams {
//   userId: string;
//   channelId: string;
//   data: Record<string, unknown>;
// }

export class NotificationsService {
  private readonly knock: Knock;

  constructor() {
    this.knock = new Knock({
      apiKey: KNOCK_API_KEY,
    });

  }

  // Creates or updates a Knock user profile with the user's name, email, and avatar
  async identifyUser(user: HydratedDocument<IUser>) {
    await this.knock.users.update(user._id.toString(), {
      name: `${user.firstName} ${user.lastName}`,
      email: user.email,
      avatar: user.profilePicture ?? null,
    });
  }

  // Deletes a user's profile from Knock
  async deleteUser(userId: string) {
    await this.knock.users.delete(userId);
  }

  // Fetches a single user's profile from Knock
  async getUser(userId: string) {
    return this.knock.users.get(userId);
  }

  // Triggers a Knock workflow for the given recipients, passing along workflow data
  async triggerWorkflow({
    workflowKey,
    recipients = ["6a7e1b58df03eba0ca87e505"],
    data,
  }: TriggerWorkflowParams) {
    return this.knock.workflows.trigger(workflowKey, {
      recipients,
      data,
    });
  }

  async setFcmToken(
    userId: string,
    token: string,
  ) {
    if (!token) {
      throw new Error("FCM token is required");
    }

    const channelData =
      await this.knock.users.getChannelData(
        userId,
        KNOCK_FCM_CHANNEL_ID,
      );

    if (!("tokens" in channelData.data)) {
      throw new NotFoundException(`No FCM tokens found for user ${userId}`,
      );

    }
    const tokens = [
      ...new Set([
        ...(channelData.data?.tokens ?? []),
        token,
      ]),
    ];

    return this.knock.users.setChannelData(
      userId,
      KNOCK_FCM_CHANNEL_ID,
      {
        data: { tokens },
      },
    );
  };

  // Sends user fcm token to Knock
  public sendUserFcmToken = async (userId: string, token: string) => {
    await this.setFcmToken(
      userId,
      token,
    );
  };

  // Sends a Knock push notification to a user
  public notifyNewMessage = async (
    recipientId: string,
    message: string,
  ) => {
    return this.triggerWorkflow({
      workflowKey: "welcome-messages",
      recipients: [recipientId],
      data: {
        message,
      },
    });
  };

  // Cancels an in-flight/scheduled workflow run identified by its cancellation key
  async cancelWorkflow(workflowKey: string, cancellationKey: string, recipients?: string[]) {
    return this.knock.workflows.cancel(workflowKey, {
      cancellation_key: cancellationKey,
      recipients: recipients ?? null,
    });
  }

  // // Sets channel-specific data for a user (e.g. push tokens, chat IDs) on a given channel
  // async setChannelData({ userId, channelId, data }: SetChannelDataParams) {
  //   return this.knock.users.setChannelData(userId, channelId, {
  //     data,
  //   });
  // }

  // // Retrieves channel-specific data for a user on a given channel
  // async getChannelData(userId: string, channelId: string) {
  //   return this.knock.users.getChannelData(userId, channelId);
  // }

  // // Retrieves a user's notification preferences
  // async getPreferences(userId: string) {
  //   return this.knock.users.getPreferences(userId);
  // }

  // // Updates a user's notification preferences
  // async setPreferences(userId: string, preferences: Record<string, unknown>) {
  //   return this.knock.users.setPreferences(userId, preferences);
  // }

  // // Fetches a user's in-app feed/messages, optionally filtered by query params
  // async getMessages(userId: string, params?: Record<string, unknown>) {
  //   return this.knock.users.getMessages(userId, params);
  // }

  // // Marks a message as read
  // async markMessageRead(messageId: string) {
  //   return this.knock.messages.markAsRead(messageId);
  // }

  // // Marks a message as seen
  // async markMessageSeen(messageId: string) {
  //   return this.knock.messages.markAsSeen(messageId);
  // }

  // // Marks a message as archived
  // async markMessageArchived(messageId: string) {
  //   return this.knock.messages.markAsArchived(messageId);
  // }

  // // Marks a message as interacted with, optionally attaching metadata about the interaction
  // async markMessageInteracted(messageId: string, metadata?: Record<string, unknown>) {
  //   return this.knock.messages.markAsInteracted(messageId, metadata);
  // }

  // // Reverts a message's status back to unread
  // async markMessageUnread(messageId: string) {
  //   return this.knock.messages.markAsUnread(messageId);
  // }

  // // Reverts a message's status back to unseen
  // async markMessageUnseen(messageId: string) {
  //   return this.knock.messages.markAsUnseen(messageId);
  // }

  // // Reverts a message's status back to unarchived
  // async markMessageUnarchived(messageId: string) {
  //   return this.knock.messages.markAsUnarchived(messageId);
  // }
}

export const notificationsService = new NotificationsService();