// client/src/api/error.ts

import { ApiRequestError } from "./client";

/** Extracts a user-displayable message from any thrown error. */
export function getErrorMessage(err: unknown): string {
  if (err instanceof ApiRequestError) return err.apiError.message ?? "Request failed";
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}
