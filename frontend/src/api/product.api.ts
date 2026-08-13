// client/src/api/product.api.ts

import { apiFetch } from "./client";
import type { Product, ProductDetail } from "../types";

export function getProducts(token: string) {
  return apiFetch<Product[]>("/products", { token });
}

export function getProductById(token: string, id: string) {
  return apiFetch<ProductDetail>(`/products/${id}`, { token });
}

export function getLowStockProducts(token: string) {
  return apiFetch<Array<{ id: string; sku: string; name: string; lowStockThreshold: number; currentStock: number }>>(
    "/products/low-stock",
    { token }
  );
}

export function createProduct(
  token: string,
  input: { sku: string; name: string; description?: string; unit?: string; lowStockThreshold?: number }
) {
  return apiFetch<Product>("/products", { method: "POST", token, body: input });
}
