// client/src/api/dashboard.api.ts

import { apiFetch } from "./client";
import type { DashboardSummary } from "../types";

export function getDashboardSummary(token: string) {
  return apiFetch<DashboardSummary>("/dashboard/summary", { token });
}
