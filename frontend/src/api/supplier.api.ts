// client/src/api/supplier.api.ts

import { apiFetch } from "./client";
import type { Supplier } from "../types";

export function getSuppliers(token: string) {
  return apiFetch<Supplier[]>("/suppliers", { token });
}

export function createSupplier(
  token: string,
  input: { name: string; contactEmail?: string; contactPhone?: string }
) {
  return apiFetch<Supplier>("/suppliers", { method: "POST", token, body: input });
}
