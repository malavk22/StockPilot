// server/src/errors/format-zod-error.ts

import { ZodError } from "zod";

/** Flattens a ZodError into a simple field -> message map for API responses. */
export function formatZodError(err: ZodError): Record<string, string> {
  const details: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_root";
    if (!details[key]) details[key] = issue.message;
  }
  return details;
}
