// server/src/middlewares/auth.middleware.ts

import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

import { AppError } from "../errors/app-error.js";
import { ERROR_CODE } from "../errors/error-codes.js";
import { HTTP_STATUS } from "../constants/http-status.js";
import { env } from "../config/env.config.js";
import type { AuthRole } from "../auth.types.js";
import type { TokenPayload } from "../services/auth.service.js";

const ALLOWED_ROLES: ReadonlySet<AuthRole> = new Set(["ADMIN", "STAFF"]);

/**
 * JWT authentication middleware.
 * Reads `Authorization: Bearer <token>`, verifies it, populates `req.auth`.
 */
export function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new AppError(
      "Missing or malformed Authorization header. Expected: Bearer <token>",
      HTTP_STATUS.UNAUTHORIZED,
      ERROR_CODE.AUTH_UNAUTHORIZED
    );
  }

  const token = authHeader.slice(7);

  let payload: TokenPayload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET) as TokenPayload;
  } catch (err) {
    const message =
      err instanceof jwt.TokenExpiredError ? "Token has expired" : "Invalid token";

    throw new AppError(message, HTTP_STATUS.UNAUTHORIZED, ERROR_CODE.AUTH_INVALID_TOKEN);
  }

  const role = payload.role as AuthRole;
  if (!ALLOWED_ROLES.has(role)) {
    throw new AppError(
      "Token contains an unrecognised role",
      HTTP_STATUS.UNAUTHORIZED,
      ERROR_CODE.AUTH_INVALID_TOKEN
    );
  }

  req.auth = { userId: payload.sub, email: payload.email, role };
  next();
}

/** Restricts a route to one or more roles. Must run after authMiddleware. */
export function requireAnyRole(roles: AuthRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!roles.includes(req.auth.role)) {
      throw new AppError(
        `Requires one of roles: ${roles.join(", ")}`,
        HTTP_STATUS.FORBIDDEN,
        ERROR_CODE.AUTH_FORBIDDEN
      );
    }
    next();
  };
}
