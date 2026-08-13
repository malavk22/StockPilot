// server/src/config/get-env.ts

/** Reads a required env var, throwing a clear error early if it's missing. */
export function getEnv(key: string): string {
  const value = process.env[key];
  if (value === undefined || value === "") {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}
