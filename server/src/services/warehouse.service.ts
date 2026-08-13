// server/src/services/warehouse.service.ts

import prisma from "../db.js";
import { AppError } from "../errors/app-error.js";
import { ERROR_CODE } from "../errors/error-codes.js";
import { HTTP_STATUS } from "../constants/http-status.js";

export async function listWarehouses() {
  return prisma.warehouse.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
  });
}

export async function createWarehouse(data: { name: string; location?: string }) {
  return prisma.warehouse.create({ data });
}

export async function getWarehouseOrThrow(id: string) {
  const warehouse = await prisma.warehouse.findFirst({
    where: { id, deletedAt: null },
  });

  if (!warehouse) {
    throw new AppError("Warehouse not found", HTTP_STATUS.NOT_FOUND, ERROR_CODE.RESOURCE_NOT_FOUND);
  }

  return warehouse;
}
