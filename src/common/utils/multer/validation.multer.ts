import { Request } from "express";
import { FileFilterCallback } from "multer";
import { BadRequestException } from "../../exceptions";

export const fileFieldValidation = {
  image: ["image/jpeg", "image/png", "image/jpg", "image/webp"],
  video: ["video/mp4", "video/mpeg", "video/quicktime"],
  audio: ["audio/mp3", "audio/mpeg", "audio/wav", "audio/ogg", "audio/webm"],
  document: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  excel: [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
  ],
  powerpoint: [
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.ms-powerpoint",
  ],
  zip: [
    "application/zip",
    "application/x-zip-compressed",
    "application/x-rar-compressed",
  ],
};

export const fileFilter = (validation: string[] = []) => {
  return function (req: Request, file: Express.Multer.File, cb: FileFilterCallback) {
    if (!validation.includes(file.mimetype)) {
      return cb(new BadRequestException("Invalid file format"));
    }
    return cb(null, true);
  };
};
