// client/src/api/stock.api.ts

import { apiFetch } from "./client";
import type { MovementType, StockMovement } from "../types";

export function getMovements(token: string, filters?: { productId?: string }) {
  const qs = filters?.productId ? `?productId=${filters.productId}` : "";
  return apiFetch<StockMovement[]>(`/stock-movements${qs}`, { token });
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
