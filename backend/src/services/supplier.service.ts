// server/src/services/supplier.service.ts

import prisma from "../db.js";
import { AppError } from "../errors/app-error.js";
import { ERROR_CODE } from "../errors/error-codes.js";
import { HTTP_STATUS } from "../constants/http-status.js";

export async function listSuppliers() {
  return prisma.supplier.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
  });
}

export async function createSupplier(data: {
  name: string;
  contactEmail?: string;
  contactPhone?: string;
}) {
  const existing = await prisma.supplier.findUnique({ where: { name: data.name } });
  if (existing) {
    throw new AppError(
      `A supplier named "${data.name}" already exists`,
      HTTP_STATUS.CONFLICT,
      ERROR_CODE.RESOURCE_CONFLICT
    );
  }

  return prisma.supplier.create({ data });
}

export async function getSupplierOrThrow(id: string) {
  const supplier = await prisma.supplier.findFirst({ where: { id, deletedAt: null } });

  if (!supplier) {
    throw new AppError("Supplier not found", HTTP_STATUS.NOT_FOUND, ERROR_CODE.RESOURCE_NOT_FOUND);
  }

  return supplier;
}
