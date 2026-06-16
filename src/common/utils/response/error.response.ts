import { Request, Response, NextFunction } from "express";
import multer from "multer";
import { NODE_ENV } from "../../../../config/config.service.js";

export interface CustomError extends Error {
  status?: number;
  extra?: any;
  cause?: {
    status?: number;
    extra?: any;
  };
}

export const globalErrorHandling = (
  error: CustomError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let status = error.status || error.cause?.status || 500;

  if (error instanceof multer.MulterError) {
    status = 400;
  }

  return res.status(status).json({
    success: false,
    message: error.message || "Something went wrong",
    ...(NODE_ENV === "development" && {
      error: error.extra ?? error.cause?.extra ?? {},
      stack: error.stack,
    }),
  });
};

export interface ExceptionParams {
  message?: string;
  status?: number;
  extra?: any;
}

export class AppError extends Error {
  status: number;
  extra?: any;

  constructor(message: string, status: number, extra?: any) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

export const ErrorException = ({
  message = "fail",
  status = 400,
  extra = undefined,
}: ExceptionParams = {}) => {
  return new AppError(message, status, extra);
};

export const BadRequestException = ({
  message = "bad request",
  status = 400,
  extra = undefined,
}: ExceptionParams = {}) => {
  return ErrorException({ message, status, extra });
};

export const UnauthorizedException = ({
  message = "unauthorized",
  status = 401,
  extra = undefined,
}: ExceptionParams = {}) => {
  return ErrorException({ message, status, extra });
};

export const ForbiddenException = ({
  message = "forbidden",
  status = 403,
  extra = undefined,
}: ExceptionParams = {}) => {
  return ErrorException({ message, status, extra });
};

export const NotFoundException = ({
  message = "not found",
  status = 404,
  extra = undefined,
}: ExceptionParams = {}) => {
  return ErrorException({ message, status, extra });
};

export const ConflictException = ({
  message = "conflict",
  status = 409,
  extra = undefined,
}: ExceptionParams = {}) => {
  return ErrorException({ message, status, extra });
};

export const TooManyRequestsException = ({
  message = "too many requests",
  status = 429,
  extra = undefined,
}: ExceptionParams = {}) => {
  return ErrorException({ message, status, extra });
};

export const ServerException = ({
  message = "server error",
  status = 500,
  extra = undefined,
}: ExceptionParams = {}) => {
  return ErrorException({ message, status, extra });
};
