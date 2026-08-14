// server/src/services/purchase-order.service.ts

import type { PurchaseOrderStatus } from "@prisma/client";
import prisma from "../db.js";
import { AppError } from "../errors/app-error.js";
import { ERROR_CODE } from "../errors/error-codes.js";
import { HTTP_STATUS } from "../constants/http-status.js";
import { getSupplierOrThrow } from "./supplier.service.js";
import { getWarehouseOrThrow } from "./warehouse.service.js";
import { getProductOrThrow } from "./product.service.js";

const INCLUDE_DETAIL = {
  supplier: true,
  warehouse: true,
  createdBy: { select: { id: true, email: true } },
  receivedBy: { select: { id: true, email: true } },
  lines: { include: { product: { select: { id: true, sku: true, name: true, unit: true } } } },
} as const;

export interface CreatePurchaseOrderInput {
  supplierId: string;
  warehouseId: string;
  notes?: string;
  lines: Array<{ productId: string; quantityOrdered: number; unitCost: number }>;
}

/**
 * Creates a purchase order in DRAFT status. Nothing touches the stock
 * ledger yet — a PO only affects inventory once it's received (see
 * receivePurchaseOrder). This lets a draft be edited/cancelled freely
 * without ever having posted a phantom stock movement.
 */
export async function createPurchaseOrder(input: CreatePurchaseOrderInput, actorUserId: string) {
  await getSupplierOrThrow(input.supplierId);
  await getWarehouseOrThrow(input.warehouseId);

  const uniqueProductIds = [...new Set(input.lines.map((l) => l.productId))];
  await Promise.all(uniqueProductIds.map((id) => getProductOrThrow(id)));

  return prisma.purchaseOrder.create({
    data: {
      supplierId: input.supplierId,
      warehouseId: input.warehouseId,
      notes: input.notes,
      createdById: actorUserId,
      lines: {
        create: input.lines.map((l) => ({
          productId: l.productId,
          quantityOrdered: l.quantityOrdered,
          unitCost: l.unitCost,
        })),
      },
    },
    include: INCLUDE_DETAIL,
  });
}

export async function listPurchaseOrders(filters: { status?: PurchaseOrderStatus; supplierId?: string }) {
  return prisma.purchaseOrder.findMany({
    where: {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.supplierId ? { supplierId: filters.supplierId } : {}),
    },
    include: INCLUDE_DETAIL,
    orderBy: { createdAt: "desc" },
  });
}

export async function getPurchaseOrderOrThrow(id: string) {
  const po = await prisma.purchaseOrder.findUnique({ where: { id }, include: INCLUDE_DETAIL });
  if (!po) {
    throw new AppError("Purchase order not found", HTTP_STATUS.NOT_FOUND, ERROR_CODE.RESOURCE_NOT_FOUND);
  }
  return po;
}

/** DRAFT → SUBMITTED. Marks the order as sent to the supplier; lines are now locked. */
export async function submitPurchaseOrder(id: string, _actorUserId: string) {
  const result = await prisma.purchaseOrder.updateMany({
    where: { id, status: "DRAFT" },
    data: { status: "SUBMITTED", submittedAt: new Date() },
  });

  if (result.count === 0) {
    throw new AppError(
      "Only a draft purchase order can be submitted",
      HTTP_STATUS.CONFLICT,
      ERROR_CODE.RESOURCE_CONFLICT
    );
  }

  return getPurchaseOrderOrThrow(id);
}

/** DRAFT or SUBMITTED → CANCELLED. A received order can never be cancelled — the stock is already in. */
export async function cancelPurchaseOrder(id: string, _actorUserId: string) {
  const result = await prisma.purchaseOrder.updateMany({
    where: { id, status: { in: ["DRAFT", "SUBMITTED"] } },
    data: { status: "CANCELLED", cancelledAt: new Date() },
  });

  if (result.count === 0) {
    throw new AppError(
      "Only a draft or submitted purchase order can be cancelled",
      HTTP_STATUS.CONFLICT,
      ERROR_CODE.RESOURCE_CONFLICT
    );
  }

  return getPurchaseOrderOrThrow(id);
}

/**
 * SUBMITTED → RECEIVED. Posts one IN stock movement per line into the
 * ledger and flips the order's status, atomically — either the whole
 * order is received and every line lands in the ledger, or none of it
 * does.
 *
 * The status guard (`status: "SUBMITTED"` in the WHERE clause of the
 * update, checked via the returned row count) is what stops two
 * concurrent "Receive" clicks from both succeeding and double-posting
 * the stock: only the request that actually flips DRAFT/SUBMITTED →
 * RECEIVED gets to create the movements, because the row lock taken by
 * the UPDATE serializes the two attempts and the loser's WHERE no
 * longer matches once the winner commits.
 */
export async function receivePurchaseOrder(id: string, actorUserId: string) {
  return prisma.$transaction(async (tx) => {
    const result = await tx.purchaseOrder.updateMany({
      where: { id, status: "SUBMITTED" },
      data: { status: "RECEIVED", receivedAt: new Date(), receivedById: actorUserId },
    });

    if (result.count === 0) {
      throw new AppError(
        "Only a submitted purchase order can be received",
        HTTP_STATUS.CONFLICT,
        ERROR_CODE.RESOURCE_CONFLICT
      );
    }

    const po = await tx.purchaseOrder.findUniqueOrThrow({ where: { id }, include: { lines: true } });

    for (const line of po.lines) {
      await tx.stockMovement.create({
        data: {
          productId: line.productId,
          warehouseId: po.warehouseId,
          type: "IN",
          quantity: line.quantityOrdered,
          reason: `Received PO-${String(po.sequenceNumber).padStart(5, "0")}`,
          createdById: actorUserId,
        },
      });
    }

    return tx.purchaseOrder.findUniqueOrThrow({ where: { id }, include: INCLUDE_DETAIL });
  });
}
