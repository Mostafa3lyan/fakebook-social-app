import { Response } from "express";

export interface SuccessResponseParams {
  message?: string;
  res: Response;
  status?: number;
  data?: any;
}

export const successResponse = ({
  message = "Success",
  res,
  status = 200,
  data = undefined,
}: SuccessResponseParams) => {
  return res.status(status).json({ message, status, data });
};
