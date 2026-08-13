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
