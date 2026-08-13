// server/src/middlewares/validate.ts

import { ZodSchema } from "zod";
import { NextFunction, Request, Response } from "express";

export const validate =
  (schema: ZodSchema) => (req: Request, _res: Response, next: NextFunction) => {
    req.body = schema.parse(req.body); // throws ZodError, caught by error-handler
    next();
  };
