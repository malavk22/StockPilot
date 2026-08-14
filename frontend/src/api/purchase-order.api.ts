// client/src/api/purchase-order.api.ts

import { apiFetch } from "./client";
import type { PurchaseOrder, PurchaseOrderStatus } from "../types";

export function getPurchaseOrders(token: string, filters?: { status?: PurchaseOrderStatus }) {
  const qs = filters?.status ? `?status=${filters.status}` : "";
  return apiFetch<PurchaseOrder[]>(`/purchase-orders${qs}`, { token });
}

export function getPurchaseOrderById(token: string, id: string) {
  return apiFetch<PurchaseOrder>(`/purchase-orders/${id}`, { token });
}

export function createPurchaseOrder(
  token: string,
  input: {
    supplierId: string;
    warehouseId: string;
    notes?: string;
    lines: Array<{ productId: string; quantityOrdered: number; unitCost: number }>;
  }
) {
  return apiFetch<PurchaseOrder>("/purchase-orders", { method: "POST", token, body: input });
}

export function submitPurchaseOrder(token: string, id: string) {
  return apiFetch<PurchaseOrder>(`/purchase-orders/${id}/submit`, { method: "POST", token });
}

export function receivePurchaseOrder(token: string, id: string) {
  return apiFetch<PurchaseOrder>(`/purchase-orders/${id}/receive`, { method: "POST", token });
}

export function cancelPurchaseOrder(token: string, id: string) {
  return apiFetch<PurchaseOrder>(`/purchase-orders/${id}/cancel`, { method: "POST", token });
}
