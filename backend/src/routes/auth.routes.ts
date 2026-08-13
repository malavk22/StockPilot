// server/src/routes/auth.routes.ts

import { Router } from "express";
import { z } from "zod";

import { validateCredentials, registerUser, signToken } from "../services/auth.service.js";
import { AppError } from "../errors/app-error.js";
import { ERROR_CODE } from "../errors/error-codes.js";
import { HTTP_STATUS } from "../constants/http-status.js";
import { asyncHandler } from "../middlewares/async-handler.js";
import { validate } from "../middlewares/validate.js";

const router = Router();

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
});

/**
 * POST /auth/register
 * Public. Body: { email, password, firstName?, lastName? }
 * New accounts are always STAFF — see auth.service.ts.
 */
router.post(
  "/register",
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof registerSchema>;
    const user = await registerUser(body);
    const token = signToken(user);

    res.status(HTTP_STATUS.CREATED).json({ token, user });
  })
);

/**
 * POST /auth/login
 * Public. Body: { email, password }
 */
router.post(
  "/login",
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as z.infer<typeof loginSchema>;
    const user = await validateCredentials(email, password);

    if (!user) {
      throw new AppError(
        "Invalid email or password",
        HTTP_STATUS.UNAUTHORIZED,
        ERROR_CODE.AUTH_UNAUTHORIZED
      );
    }

    const token = signToken(user);
    res.status(HTTP_STATUS.OK).json({ token, user });
  })
);

export default router;
