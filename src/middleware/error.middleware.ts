import type { NextFunction, Request, Response } from "express";
import { ApplicationException } from "../common/exceptions";

interface IError extends Error {
  statusCode: number;
}

export const globalErrorHandler = (
  error: IError,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  // known operational error — safe to expose message + code
  if (error instanceof ApplicationException) {
    return res.status(error.statusCode).json({
      status: error.statusCode || 500,
      message: error.message,
      cause: error.cause,
      stack: error.stack,
      error,
      // ...(process.env.NODE_ENV === "development" && { stack: error.stack }),
    });
  }

  // unexpected error — log internally, return generic message
  console.error("[Unhandled Error]", error);

  return res.status(500).json({
    status: 500,
    message: "internal server error",
  });
};