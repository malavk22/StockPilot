// server/src/config/http.config.ts

import { env } from "./env.config.js";

// Supports a comma-separated list so staging/prod can allow multiple origins.
const allowedOrigins = env.CORS_ORIGIN.split(",")
  .map((o) => o.trim())
  .filter(Boolean);

export const httpConfig = {
  bodyLimit: "1mb",
  cors: {
    origin: allowedOrigins,
  },
};
