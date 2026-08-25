import type { NextFunction, Request, Response } from "express";
import { ZodError, ZodType } from "zod";
import { BadRequestException } from "../common/exceptions";

type keyReqType = "body" | "query" | "params" | "headers" | "file" | "files"
type SchemaType = Partial<Record<keyReqType, ZodType>>;
type issuesType = Array<{ key: keyReqType; issues: Array<{ message: string; path: (string | number | symbol | undefined | null)[] }> }>;
export const validation = (schema: SchemaType) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const issues: issuesType = [];
    const parsed: Partial<Record<keyReqType, unknown>> = {};

    for (const key of Object.keys(schema) as keyReqType[]) {
      if (!schema[key]) continue; // Skip if no schema for this key

      // Express 5 leaves `req.body` as `undefined` (not `{}`) when there is no
      // parseable body. Parsing that yields one useless top-level issue and stops
      // `.default()` from firing, so treat a missing container as empty.
      const validationResult = schema[key].safeParse(req[key] ?? {});
      if (!validationResult.success) {
        const error = validationResult.error as ZodError;
        issues.push({ key, issues: error.issues.map((issue) => ({ message: issue.message, path: issue.path })) });
        continue;
      }
      parsed[key] = validationResult.data;
    }

    if (issues.length) {
      throw new BadRequestException("Validation error", { error: issues });
    }

    // Write the parsed values back, otherwise `.default()`, `z.coerce`, and
    // unknown-key stripping are all silently discarded.
    if ("body" in parsed) req.body = parsed.body;
    // Safe because `validation` is always registered inside a `router.METHOD(...)`
    // stack — the router assigns `req.params` at layer-match time, before this runs.
    if ("params" in parsed) req.params = parsed.params as typeof req.params;
    if ("query" in parsed) {
      // `req.query` is a getter-only accessor on the prototype that re-parses on
      // every read, so plain assignment throws. Shadow it with an own property.
      Object.defineProperty(req, "query", {
        value: parsed.query,
        writable: true,
        configurable: true,
        enumerable: true,
      });
    }
    // `headers`, `file`, and `files` are deliberately not written back — Node,
    // multer, and downstream middleware read the original objects.

    next();
  };
};
