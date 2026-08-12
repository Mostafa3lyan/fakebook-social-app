import type { Response } from "express";

export const successResponse = <T>({ res, message = "success", status = 200, data }: { res: Response, status?: number, message?: string, data?: T }) => {
  res.status(status).json({
    message,
    status,
    data,
  });
};