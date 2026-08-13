// client/src/api/warehouse.api.ts

import { apiFetch } from "./client";
import type { Warehouse } from "../types";

export function getWarehouses(token: string) {
  return apiFetch<Warehouse[]>("/warehouses", { token });
}

export function createWarehouse(token: string, input: { name: string; location?: string }) {
  return apiFetch<Warehouse>("/warehouses", { method: "POST", token, body: input });
}
