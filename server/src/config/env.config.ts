// server/src/config/env.config.ts

import dotenv from "dotenv";
import path from "path";
import { z } from "zod";
import { getEnv } from "./get-env.js";

// Load .env.local (developer overrides) first, then .env — mirrors dotenv's
// own precedence rules: first value set wins, so .env.local takes priority.
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
  PORT: z.string().transform(Number),
  DATABASE_URL: z.string(),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_EXPIRES_IN: z.string().default("8h"),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
});

export const env = envSchema.parse({
  NODE_ENV: getEnv("NODE_ENV"),
  PORT: getEnv("PORT"),
  DATABASE_URL: getEnv("DATABASE_URL"),
  JWT_SECRET: getEnv("JWT_SECRET"),
  JWT_EXPIRES_IN: process.env["JWT_EXPIRES_IN"],
  CORS_ORIGIN: process.env["CORS_ORIGIN"],
});
