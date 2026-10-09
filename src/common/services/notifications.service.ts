import Knock from "@knocklabs/node";
import { HydratedDocument } from "mongoose";
import { IUser } from "../interfaces";
import { KNOCK_API_KEY, KNOCK_FCM_CHANNEL_ID } from "../../config/config.service";
import { NotFoundException } from "../exceptions";

interface TriggerWorkflowParams {
  workflowKey: string;
  recipients: string[];
  data: Record<string, unknown>;
}

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
      throw new NotFoundException(`No FCM tokens found for user ${userId}`);
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
  }

  // Sends user fcm token to Knock
  public sendUserFcmToken = async (userId: string, token: string) => {
    await this.setFcmToken(
      userId,
      token,
    );
  };

  // Sends a Knock push notification to a user
  public notifyNewMessage = async ({
    recipientId,
    message,
  }: {
    recipientId: string,
    message: string,
  }) => {
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
}

export const notificationsService = new NotificationsService();
