// server/src/services/auth.service.ts

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import prisma from "../db.js";
import { env } from "../config/env.config.js";
import type { AuthRole } from "../auth.types.js";
import { AppError } from "../errors/app-error.js";
import { ERROR_CODE } from "../errors/error-codes.js";
import { HTTP_STATUS } from "../constants/http-status.js";

export interface TokenPayload {
  sub: string; // userId
  email: string;
  role: AuthRole;
}

export interface SafeUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: AuthRole;
}

const SAFE_USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
} as const;

/**
 * Creates a new user account. Throws RESOURCE_CONFLICT if the email is taken.
 * Role is always STAFF here — there is no client-controlled way to self-grant
 * ADMIN. The first real admin is created via the seed script or promoted by
 * an existing admin (not implemented yet — deliberately out of MVP scope).
 */
export async function registerUser(data: {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}): Promise<SafeUser> {
  const existing = await prisma.user.findUnique({
    where: { email: data.email },
    select: { id: true },
  });

  if (existing) {
    throw new AppError(
      "An account with this email already exists",
      HTTP_STATUS.CONFLICT,
      ERROR_CODE.RESOURCE_CONFLICT
    );
  }

  const passwordHash = await bcrypt.hash(data.password, 10);

  const user = await prisma.user.create({
    data: {
      email: data.email,
      passwordHash,
      firstName: data.firstName ?? null,
      lastName: data.lastName ?? null,
      role: "STAFF",
    },
    select: SAFE_USER_SELECT,
  });

  return user as SafeUser;
}

/**
 * Verifies email + password. Returns the safe user or null on any mismatch
 * (unknown user, deleted user, wrong password) — same response for all three
 * so the API never reveals whether an email is registered.
 */
export async function validateCredentials(
  email: string,
  password: string
): Promise<SafeUser | null> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { ...SAFE_USER_SELECT, passwordHash: true, deletedAt: true },
  });

  if (!user || user.deletedAt !== null) return null;

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) return null;

  const { passwordHash: _omit, deletedAt: _omit2, ...safeUser } = user;
  return safeUser as SafeUser;
}

/** Signs a short-lived JWT access token for the given user. */
export function signToken(user: SafeUser): string {
  const payload: TokenPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
  };

  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });
}
