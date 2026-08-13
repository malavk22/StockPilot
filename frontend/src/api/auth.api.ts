// client/src/api/auth.api.ts

import { apiFetch } from "./client";
import type { User } from "../types";

interface AuthResponse {
  token: string;
  user: User;
}

export function login(email: string, password: string) {
  return apiFetch<AuthResponse>("/auth/login", { method: "POST", body: { email, password } });
}

export function register(input: {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}) {
  return apiFetch<AuthResponse>("/auth/register", { method: "POST", body: input });
}
