import type { NextFunction, Request, Response } from "express";
import { ZodError, ZodType } from "zod";
import { BadRequestException } from "../common/exceptions";

type keyReqType = "body" | "query" | "params" | "headers"
type SchemaType = Partial<Record<keyReqType, ZodType>>;
type issuesType = Array<{ key: keyReqType; issues: Array<{ message: string; path: (string | number | symbol | undefined | null)[] }> }>;
export const validation = (schema: SchemaType) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const issues: issuesType = [];

    for (const key of Object.keys(schema) as keyReqType[]) {
      if (!schema[key]) continue; // Skip if no schema for this key
      const validationResult = schema[key].safeParse(req[key]);
      if (!validationResult.success) {
        const error = validationResult.error as ZodError;
        issues.push({ key, issues: error.issues.map((issue) => ({ message: issue.message, path: issue.path })) });
      }
    }

    if (issues.length) {
      throw new BadRequestException("Validation error", { error: issues });
    }

    next();
  };
}; 