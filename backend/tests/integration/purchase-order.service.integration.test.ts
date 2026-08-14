// backend/tests/integration/purchase-order.service.integration.test.ts
//
// Runs against the real test database — the thing worth verifying here is
// that receiving a PO posts the ledger entries and flips the status
// atomically, and that the status guards actually stop invalid transitions
// (double-receive, receiving a draft, cancelling a received order).

import { describe, it, expect, beforeEach, afterAll } from "vitest";
import bcrypt from "bcryptjs";
import prisma from "../../src/db.js";
import {
  createPurchaseOrder,
  submitPurchaseOrder,
  receivePurchaseOrder,
  cancelPurchaseOrder,
} from "../../src/services/purchase-order.service.js";
import { getCurrentStock } from "../../src/services/stock.service.js";
import { AppError } from "../../src/errors/app-error.js";

let userId: string;
let warehouseId: string;
let supplierId: string;
let productId: string;

beforeEach(async () => {
  // Clean slate — order matters for FK constraints.
  await prisma.purchaseOrderLine.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.product.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.warehouse.deleteMany();
  await prisma.user.deleteMany();

  const user = await prisma.user.create({
    data: {
      email: `test-${Date.now()}@stockpilot.test`,
      passwordHash: await bcrypt.hash("irrelevant", 4),
      role: "STAFF",
    },
  });
  userId = user.id;

  const warehouse = await prisma.warehouse.create({ data: { name: "Test Warehouse" } });
  warehouseId = warehouse.id;

  const supplier = await prisma.supplier.create({ data: { name: "Test Supplier" } });
  supplierId = supplier.id;

  const product = await prisma.product.create({
    data: { sku: "TEST-SKU", name: "Test Widget", lowStockThreshold: 5 },
  });
  productId = product.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("createPurchaseOrder", () => {
  it("creates a DRAFT order with its line items and does not touch the ledger", async () => {
    const po = await createPurchaseOrder(
      { supplierId, warehouseId, lines: [{ productId, quantityOrdered: 20, unitCost: 5 }] },
      userId
    );

    expect(po.status).toBe("DRAFT");
    expect(po.lines).toHaveLength(1);
    expect(await getCurrentStock(productId)).toBe(0);
  });
});

describe("purchase order lifecycle", () => {
  it("rejects receiving a draft order (must be submitted first)", async () => {
    const po = await createPurchaseOrder(
      { supplierId, warehouseId, lines: [{ productId, quantityOrdered: 10, unitCost: 5 }] },
      userId
    );

    await expect(receivePurchaseOrder(po.id, userId)).rejects.toThrow(AppError);
    expect(await getCurrentStock(productId)).toBe(0);
  });

  it("posts one IN movement per line and flips status to RECEIVED on receipt", async () => {
    const po = await createPurchaseOrder(
      { supplierId, warehouseId, lines: [{ productId, quantityOrdered: 10, unitCost: 5 }] },
      userId
    );

    await submitPurchaseOrder(po.id, userId);
    const received = await receivePurchaseOrder(po.id, userId);

    expect(received.status).toBe("RECEIVED");
    expect(await getCurrentStock(productId, warehouseId)).toBe(10);

    const movements = await prisma.stockMovement.findMany({ where: { productId } });
    expect(movements).toHaveLength(1);
    expect(movements[0]?.type).toBe("IN");
    expect(movements[0]?.quantity).toBe(10);
  });

  it("rejects receiving the same order twice (no double-posting stock)", async () => {
    const po = await createPurchaseOrder(
      { supplierId, warehouseId, lines: [{ productId, quantityOrdered: 10, unitCost: 5 }] },
      userId
    );

    await submitPurchaseOrder(po.id, userId);
    await receivePurchaseOrder(po.id, userId);

    await expect(receivePurchaseOrder(po.id, userId)).rejects.toThrow(AppError);
    expect(await getCurrentStock(productId)).toBe(10);
  });

  it("allows cancelling a draft order", async () => {
    const po = await createPurchaseOrder(
      { supplierId, warehouseId, lines: [{ productId, quantityOrdered: 10, unitCost: 5 }] },
      userId
    );

    const cancelled = await cancelPurchaseOrder(po.id, userId);
    expect(cancelled.status).toBe("CANCELLED");
  });

  it("rejects cancelling a received order — the stock is already in", async () => {
    const po = await createPurchaseOrder(
      { supplierId, warehouseId, lines: [{ productId, quantityOrdered: 10, unitCost: 5 }] },
      userId
    );

    await submitPurchaseOrder(po.id, userId);
    await receivePurchaseOrder(po.id, userId);

    await expect(cancelPurchaseOrder(po.id, userId)).rejects.toThrow(AppError);
  });
});
