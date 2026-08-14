// client/src/api/stock.api.ts

import { apiFetch } from "./client";
import type { MovementType, StockMovement } from "../types";

export function getMovements(
  token: string,
  filters?: { productId?: string; warehouseId?: string; type?: MovementType; limit?: number }
) {
  const params = new URLSearchParams();
  if (filters?.productId) params.set("productId", filters.productId);
  if (filters?.warehouseId) params.set("warehouseId", filters.warehouseId);
  if (filters?.type) params.set("type", filters.type);
  if (filters?.limit) params.set("limit", String(filters.limit));
  const qs = params.toString();
  return apiFetch<StockMovement[]>(`/stock-movements${qs ? `?${qs}` : ""}`, { token });
}

export function recordMovement(
  token: string,
  input: {
    type: MovementType;
    productId: string;
    warehouseId: string;
    quantity: number;
    reason?: string;
  }
) {
  return apiFetch<StockMovement>("/stock-movements", { method: "POST", token, body: input });
}

export function transferStock(
  token: string,
  input: {
    productId: string;
    fromWarehouseId: string;
    toWarehouseId: string;
    quantity: number;
    reason?: string;
  }
) {
  return apiFetch<{ out: StockMovement; in: StockMovement }>("/stock-movements/transfer", {
    method: "POST",
    token,
    body: input,
  });
}
