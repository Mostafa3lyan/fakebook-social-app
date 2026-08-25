import type { NextFunction, Request, Response } from "express";
import { MulterError } from "multer";
import { ApplicationException, BadRequestException } from "../common/exceptions";
import { NODE_ENV } from "../config/config.service";

const isDevelopment = NODE_ENV === "development";

// Returns the operational exception this error represents, or null when the
// error is unexpected and must not be exposed to the client.
const asOperational = (error: unknown): ApplicationException | null => {
  if (error instanceof ApplicationException) return error;

  if (error instanceof MulterError) {
    return new BadRequestException(error.message, {
      code: error.code,
      field: error.field,
    });
  }

  return null;
};

export const globalErrorHandler = (
  error: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  const operational = asOperational(error);

  // known operational error — safe to expose message + cause
  if (operational) {
    return res.status(operational.statusCode).json({
      status: operational.statusCode,
      message: operational.message,
      ...(operational.cause !== undefined && { cause: operational.cause }),
      ...(isDevelopment && { stack: operational.stack }),
    });
  }

  // unexpected error — log internally, return generic message
  console.error("[Unhandled Error]", error);

  return res.status(500).json({
    status: 500,
    message: "internal server error",
    ...(isDevelopment && {
      name: error?.name,
      detail: error?.message,
      stack: error?.stack,
    }),
  });
};