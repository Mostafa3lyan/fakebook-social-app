import type { NextFunction, Request, Response } from "express";
import { MulterError } from "multer";
import { ApplicationException, BadRequestException, ConflictException } from "../common/exceptions";
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

  // Body parser JSON syntax error
  if (error instanceof SyntaxError && "status" in error && (error as any).status === 400 && "body" in error) {
    return new BadRequestException("Malformed JSON in request body");
  }

  // MongoDB duplicate key error (code 11000)
  if (typeof error === "object" && error !== null && (error as any).code === 11000) {
    const fields = Object.keys((error as any).keyPattern || (error as any).keyValue || {}).join(", ");
    return new ConflictException(`Duplicate value for field: ${fields || "unique key"}`);
  }

  // Mongoose validation error
  if (typeof error === "object" && error !== null && (error as any).name === "ValidationError") {
    const errObj = error as { message: string; errors?: Record<string, { message: string; path: string }> };
    const issues = errObj.errors
      ? Object.values(errObj.errors).map((e) => ({ path: e.path, message: e.message }))
      : errObj.message;
    return new BadRequestException("Validation error", issues);
  }

  // Mongoose cast error (e.g. invalid ObjectId)
  if (typeof error === "object" && error !== null && (error as any).name === "CastError") {
    const errObj = error as { path: string; value: unknown };
    return new BadRequestException(`Invalid value for field '${errObj.path}': ${String(errObj.value)}`);
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