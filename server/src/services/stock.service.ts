// server/src/services/stock.service.ts

import { Prisma } from "@prisma/client";
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

  const signedQuantity = input.type === "OUT" ? -input.quantity : input.quantity;

  try {
    return await prisma.$transaction(
      async (tx) => {
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
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
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

export async function listMovements(filters: { productId?: string; warehouseId?: string }) {
  return prisma.stockMovement.findMany({
    where: {
      ...(filters.productId ? { productId: filters.productId } : {}),
      ...(filters.warehouseId ? { warehouseId: filters.warehouseId } : {}),
    },
    include: {
      product: { select: { id: true, sku: true, name: true } },
      warehouse: { select: { id: true, name: true } },
      createdBy: { select: { id: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
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
