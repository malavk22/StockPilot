// client/src/api/client.ts
//
// Thin fetch wrapper. Deliberately doesn't know about auth storage — it
// takes a token as a parameter and lets the caller (AuthContext-aware API
// modules) decide where that token comes from. Keeps this module testable
// and free of hidden global state.

import type { ApiError } from "../types";

const BASE_URL = (import.meta.env.VITE_API_URL ?? "http://localhost:5100").replace(/\/$/, "");

export class ApiRequestError extends Error {
  status: number;
  apiError: ApiError;

  constructor(status: number, apiError: ApiError) {
    super(apiError.message);
    this.status = status;
    this.apiError = apiError;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  token?: string | null;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  // 204 / empty body responses
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    throw new ApiRequestError(res.status, data as ApiError);
  }

  return data as T;
}
