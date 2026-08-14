// client/src/api/report.api.ts
//
// The report endpoint returns a raw PDF, not JSON, so it can't go through
// the shared apiFetch<T>() helper — it needs a blob response instead.

import { BASE_URL, ApiRequestError } from "./client";
import type { ApiError } from "../types";

/** Fetches the inventory report PDF and triggers a browser download for it. */
export async function downloadInventoryReport(token: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/reports/inventory`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as ApiError | null;
    throw new ApiRequestError(res.status, data ?? { errorCode: "UNKNOWN", message: "Report download failed" });
  }

  const blob = await res.blob();
  const filename =
    res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ??
    `stockpilot-inventory-report-${new Date().toISOString().slice(0, 10)}.pdf`;

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
