// server/src/middlewares/error-handler.ts

import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

import { AppError } from "../errors/app-error.js";
import { ERROR_CODE } from "../errors/error-codes.js";
import { formatZodError } from "../errors/format-zod-error.js";
import { HTTP_STATUS } from "../constants/http-status.js";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof ZodError) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      errorCode: ERROR_CODE.VALIDATION_ERROR,
      message: "Validation failed",
      details: formatZodError(err),
    });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      errorCode: err.errorCode,
      message: err.message,
    });
  }

  // Unknown / programming error — log full detail server-side,
  // never leak internals to the client.
  console.error(err);

  return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
    errorCode: ERROR_CODE.INTERNAL_SERVER_ERROR,
    message: "Something went wrong",
  });
}
