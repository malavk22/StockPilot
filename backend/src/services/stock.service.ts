// server/src/services/stock.service.ts

import { Prisma, type MovementType } from "@prisma/client";
import prisma from "../db.js";
import { AppError } from "../errors/app-error.js";
import { ERROR_CODE } from "../errors/error-codes.js";
import { HTTP_STATUS } from "../constants/http-status.js";
import { getProductOrThrow } from "./product.service.js";
import { getWarehouseOrThrow } from "./warehouse.service.js";

export type MovementInput =
  | { type: "IN"; productId: string; warehouseId: string; quantity: number; reason?: string }
  | { type: "OUT"; productId: string; warehouseId: string; quantity: number; reason?: string }
  | { type: "ADJUSTMENT"; productId: string; warehouseId: string; quantity: number; reason: string };

/**
 * Converts a movement's user-facing quantity into the signed value stored
 * in the ledger. Pulled out as a pure function so the sign rule (the one
 * bit of this file that's easy to get subtly wrong) is independently
 * testable without a database.
 */
export function computeSignedQuantity(type: MovementInput["type"], quantity: number): number {
  return type === "OUT" ? -quantity : quantity;
}

/**
 * Records a stock movement.
 *
 * Concurrency safety: runs in a SERIALIZABLE transaction. Two requests
 * trying to sell the last few units of the same product at the same time
 * will not both succeed and push stock negative — Postgres detects the
 * write-write conflict and one transaction fails with a serialization
 * error (P2034), which we surface as a 409 so the client can retry.
 *
 * Without this, a naive "read current stock, check it's enough, then
 * insert" sequence has a race window between the read and the insert
 * where two concurrent requests can both pass the check.
 */
export async function recordMovement(input: MovementInput, actorUserId: string) {
  await getProductOrThrow(input.productId);
  await getWarehouseOrThrow(input.warehouseId);

  const signedQuantity = computeSignedQuantity(input.type, input.quantity);

  return runInSerializableTx(async (tx) => {
    if (input.type === "OUT") {
      const current = await getCurrentStockInTx(tx, input.productId, input.warehouseId);
      if (current + signedQuantity < 0) {
        throw new AppError(
          `Insufficient stock: ${current} available, ${input.quantity} requested`,
          HTTP_STATUS.CONFLICT,
          ERROR_CODE.RESOURCE_CONFLICT
        );
      }
    }

    return tx.stockMovement.create({
      data: {
        productId: input.productId,
        warehouseId: input.warehouseId,
        type: input.type,
        quantity: signedQuantity,
        reason: input.reason,
        createdById: actorUserId,
      },
    });
  });
}

export interface TransferInput {
  productId: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  quantity: number;
  reason?: string;
}

/**
 * Moves stock between two warehouses. Recorded as two linked ledger rows
 * (TRANSFER_OUT at the source, TRANSFER_IN at the destination) created in
 * one atomic, serializable transaction — either both are written or
 * neither is. The product's total stock is unaffected; only its location
 * changes. Reuses the same oversell guard as a regular OUT movement.
 */
export async function transferStock(input: TransferInput, actorUserId: string) {
  await getProductOrThrow(input.productId);
  await getWarehouseOrThrow(input.fromWarehouseId);
  await getWarehouseOrThrow(input.toWarehouseId);

  return runInSerializableTx(async (tx) => {
    const current = await getCurrentStockInTx(tx, input.productId, input.fromWarehouseId);
    if (current - input.quantity < 0) {
      throw new AppError(
        `Insufficient stock at source warehouse: ${current} available, ${input.quantity} requested`,
        HTTP_STATUS.CONFLICT,
        ERROR_CODE.RESOURCE_CONFLICT
      );
    }

    const reason = input.reason ?? "Warehouse transfer";

    const out = await tx.stockMovement.create({
      data: {
        productId: input.productId,
        warehouseId: input.fromWarehouseId,
        type: "TRANSFER_OUT",
        quantity: -input.quantity,
        reason,
        createdById: actorUserId,
      },
    });

    const inMovement = await tx.stockMovement.create({
      data: {
        productId: input.productId,
        warehouseId: input.toWarehouseId,
        type: "TRANSFER_IN",
        quantity: input.quantity,
        reason,
        createdById: actorUserId,
      },
    });

    return { out, in: inMovement };
  });
}

/**
 * Runs `fn` inside a SERIALIZABLE transaction and translates Postgres's
 * serialization-failure error (P2034) into a 409 the client can retry.
 *
 * Shared by recordMovement and transferStock — both need the same
 * concurrency guarantee: two conflicting writes against the same
 * product/warehouse can't both succeed and silently corrupt the total.
 */
async function runInSerializableTx<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  try {
    return await prisma.$transaction(fn, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034") {
      throw new AppError(
        "This item was updated concurrently — please retry",
        HTTP_STATUS.CONFLICT,
        ERROR_CODE.RESOURCE_CONFLICT
      );
    }
    throw err;
  }
}

async function getCurrentStockInTx(
  tx: Prisma.TransactionClient,
  productId: string,
  warehouseId: string
): Promise<number> {
  const result = await tx.stockMovement.aggregate({
    where: { productId, warehouseId },
    _sum: { quantity: true },
  });
  return result._sum.quantity ?? 0;
}

/** Current stock for a product, summed across all warehouses (or one, if given). */
export async function getCurrentStock(productId: string, warehouseId?: string) {
  const result = await prisma.stockMovement.aggregate({
    where: { productId, ...(warehouseId ? { warehouseId } : {}) },
    _sum: { quantity: true },
  });
  return result._sum.quantity ?? 0;
}

/**
 * A product's stock broken down by warehouse (only warehouses that have at
 * least one movement for this product are included). Feeds the product
 * detail page's "where is this actually sitting" view.
 */
export async function getStockByWarehouse(productId: string) {
  const rows = await prisma.stockMovement.groupBy({
    by: ["warehouseId"],
    where: { productId },
    _sum: { quantity: true },
  });

  const warehouses = await prisma.warehouse.findMany({
    where: { id: { in: rows.map((r) => r.warehouseId) } },
    select: { id: true, name: true },
  });
  const nameById = new Map(warehouses.map((w) => [w.id, w.name]));

  return rows
    .map((r) => ({
      warehouseId: r.warehouseId,
      warehouseName: nameById.get(r.warehouseId) ?? "Unknown",
      quantity: r._sum.quantity ?? 0,
    }))
    .filter((r) => r.quantity !== 0)
    .sort((a, b) => b.quantity - a.quantity);
}

export async function listMovements(filters: {
  productId?: string;
  warehouseId?: string;
  type?: MovementType;
  limit?: number;
}) {
  return prisma.stockMovement.findMany({
    where: {
      ...(filters.productId ? { productId: filters.productId } : {}),
      ...(filters.warehouseId ? { warehouseId: filters.warehouseId } : {}),
      ...(filters.type ? { type: filters.type } : {}),
    },
    include: {
      product: { select: { id: true, sku: true, name: true } },
      warehouse: { select: { id: true, name: true } },
      createdBy: { select: { id: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    ...(filters.limit ? { take: filters.limit } : {}),
  });
}

/**
 * Products whose total stock (across all warehouses) is at or below their
 * configured low-stock threshold. Computed in a single SQL query — doing
 * this as "fetch all products, then fetch all movements, then join in JS"
 * doesn't scale past a trivial dataset.
 */
export async function getLowStockProducts() {
  const rows = await prisma.$queryRaw<
    Array<{ id: string; sku: string; name: string; lowStockThreshold: number; currentStock: bigint }>
  >`
    SELECT p.id, p.sku, p.name, p."lowStockThreshold",
           COALESCE(SUM(sm.quantity), 0) AS "currentStock"
    FROM "Product" p
    LEFT JOIN "StockMovement" sm ON sm."productId" = p.id
    WHERE p."deletedAt" IS NULL
    GROUP BY p.id
    HAVING COALESCE(SUM(sm.quantity), 0) <= p."lowStockThreshold"
    ORDER BY p.name;
  `;

  // Postgres SUM() over an integer column returns bigint — res.json() can't
  // serialize BigInt, so normalize to number here (safe: real-world stock
  // counts never approach Number.MAX_SAFE_INTEGER).
  return rows.map((row) => ({ ...row, currentStock: Number(row.currentStock) }));
}
