// server/src/services/product.service.ts

import prisma from "../db.js";
import { AppError } from "../errors/app-error.js";
import { ERROR_CODE } from "../errors/error-codes.js";
import { HTTP_STATUS } from "../constants/http-status.js";

export async function listProducts() {
  return prisma.product.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
  });
}

export async function createProduct(data: {
  sku: string;
  name: string;
  description?: string;
  unit: string;
  price: number;
  lowStockThreshold: number;
}) {
  const existing = await prisma.product.findUnique({ where: { sku: data.sku } });
  if (existing) {
    throw new AppError(
      `A product with SKU "${data.sku}" already exists`,
      HTTP_STATUS.CONFLICT,
      ERROR_CODE.RESOURCE_CONFLICT
    );
  }

  return prisma.product.create({ data });
}

export async function getProductOrThrow(id: string) {
  const product = await prisma.product.findFirst({ where: { id, deletedAt: null } });

  if (!product) {
    throw new AppError("Product not found", HTTP_STATUS.NOT_FOUND, ERROR_CODE.RESOURCE_NOT_FOUND);
  }

  return product;
}
