import { ObjectCannedACL, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { APP_NAME, AWS_ACCESS_KEY_ID, AWS_BUCKET_NAME, AWS_REGION, AWS_SECRET_ACCESS_KEY } from "../../config/config.service";
import { randomUUID } from "node:crypto";
import { BadRequestException } from "../exceptions";
import { StorageApproachEnum } from "../enums";
import { createReadStream } from "node:fs";

export class S3Service {

  private client: S3Client;
  constructor() {
    this.client = new S3Client({
      region: AWS_REGION,
      credentials: {
        accessKeyId: AWS_ACCESS_KEY_ID,
        secretAccessKey: AWS_SECRET_ACCESS_KEY,
      },
    });
  }

  async uploadAsset({
    storageApproach = StorageApproachEnum.MEMORY,
    bucket = AWS_BUCKET_NAME,
    path = "general",
    file,
    ACL = ObjectCannedACL.private,
    contentType
  }: {
    storageApproach?: StorageApproachEnum,
    bucket?: string,
    path?: string,
    file: Express.Multer.File,
    ACL?: ObjectCannedACL,
    contentType?: string,
  }) {
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: `${APP_NAME}/${path}/${randomUUID()}__${file.originalname}`,
      ACL,
      Body: storageApproach === StorageApproachEnum.MEMORY ? file.buffer : createReadStream(file.path),
      ContentType: contentType,
    });

    if (!command.input.Key) {
      throw new BadRequestException("failed to upload asset");
    }

    await this.client.send(command);

    return command.input.Key;
  }
}

export const s3Service = new S3Service();