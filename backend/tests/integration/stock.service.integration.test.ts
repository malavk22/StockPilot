// backend/tests/integration/stock.service.integration.test.ts
//
// Runs against a real Postgres database (stockpilot_test_db, see
// tests/setup.ts) rather than mocking Prisma — the whole point of this
// service is correct behavior under real transactions and constraints,
// which a mock can't verify.

import { describe, it, expect, beforeEach, afterAll } from "vitest";
import bcrypt from "bcryptjs";
import prisma from "../../src/db.js";
import {
  recordMovement,
  transferStock,
  getCurrentStock,
  getLowStockProducts,
} from "../../src/services/stock.service.js";
import { AppError } from "../../src/errors/app-error.js";

let userId: string;
let warehouseId: string;
let secondWarehouseId: string;
let productId: string;

beforeEach(async () => {
  // Clean slate for every test — order matters for FK constraints
  // (StockMovement references Product/Warehouse/User; PurchaseOrderLine
  // also references Product, so it has to go before the product wipe too).
  await prisma.purchaseOrderLine.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.product.deleteMany();
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

  const secondWarehouse = await prisma.warehouse.create({ data: { name: "Second Warehouse" } });
  secondWarehouseId = secondWarehouse.id;

  const product = await prisma.product.create({
    data: { sku: "TEST-SKU", name: "Test Widget", lowStockThreshold: 5 },
  });
  productId = product.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("recordMovement", () => {
  it("records an IN movement and reflects it in current stock", async () => {
    await recordMovement({ type: "IN", productId, warehouseId, quantity: 10 }, userId);
    expect(await getCurrentStock(productId)).toBe(10);
  });

  it("computes current stock as the sum of IN and OUT movements", async () => {
    await recordMovement({ type: "IN", productId, warehouseId, quantity: 10 }, userId);
    await recordMovement({ type: "OUT", productId, warehouseId, quantity: 3 }, userId);
    expect(await getCurrentStock(productId)).toBe(7);
  });

  it("rejects an OUT movement that would push stock negative", async () => {
    await recordMovement({ type: "IN", productId, warehouseId, quantity: 5 }, userId);

    await expect(
      recordMovement({ type: "OUT", productId, warehouseId, quantity: 10 }, userId)
    ).rejects.toThrow(AppError);

    // The rejected movement must not have been partially recorded.
    expect(await getCurrentStock(productId)).toBe(5);
  });

  it("allows an OUT movement that exactly zeroes stock", async () => {
    await recordMovement({ type: "IN", productId, warehouseId, quantity: 5 }, userId);
    await recordMovement({ type: "OUT", productId, warehouseId, quantity: 5 }, userId);
    expect(await getCurrentStock(productId)).toBe(0);
  });

  it("applies ADJUSTMENT deltas directly, including negative corrections", async () => {
    await recordMovement({ type: "IN", productId, warehouseId, quantity: 10 }, userId);
    await recordMovement(
      { type: "ADJUSTMENT", productId, warehouseId, quantity: -2, reason: "Damaged in transit" },
      userId
    );
    expect(await getCurrentStock(productId)).toBe(8);
  });
});

describe("transferStock", () => {
  it("moves stock between warehouses without changing the product's total", async () => {
    await recordMovement({ type: "IN", productId, warehouseId, quantity: 10 }, userId);

    await transferStock(
      { productId, fromWarehouseId: warehouseId, toWarehouseId: secondWarehouseId, quantity: 4 },
      userId
    );

    expect(await getCurrentStock(productId, warehouseId)).toBe(6);
    expect(await getCurrentStock(productId, secondWarehouseId)).toBe(4);
    // Total across all warehouses is unchanged by a transfer.
    expect(await getCurrentStock(productId)).toBe(10);
  });

  it("rejects a transfer that would push the source warehouse negative", async () => {
    await recordMovement({ type: "IN", productId, warehouseId, quantity: 3 }, userId);

    await expect(
      transferStock(
        { productId, fromWarehouseId: warehouseId, toWarehouseId: secondWarehouseId, quantity: 10 },
        userId
      )
    ).rejects.toThrow(AppError);

    // Neither leg of the transfer should have been written.
    expect(await getCurrentStock(productId, warehouseId)).toBe(3);
    expect(await getCurrentStock(productId, secondWarehouseId)).toBe(0);
  });
});

describe("getLowStockProducts", () => {
  it("includes a product at or below its threshold and excludes one above it", async () => {
    // productId has lowStockThreshold: 5
    await recordMovement({ type: "IN", productId, warehouseId, quantity: 3 }, userId);

    const wellStocked = await prisma.product.create({
      data: { sku: "TEST-SKU-2", name: "Well Stocked Widget", lowStockThreshold: 5 },
    });
    await recordMovement(
      { type: "IN", productId: wellStocked.id, warehouseId, quantity: 50 },
      userId
    );

    const lowStock = await getLowStockProducts();
    const skus = lowStock.map((p) => p.sku);

    expect(skus).toContain("TEST-SKU");
    expect(skus).not.toContain("TEST-SKU-2");
  });
});
