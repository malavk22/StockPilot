// backend/tests/integration/warehouse.service.integration.test.ts
//
// Runs against the real test database — the unique constraint on
// Warehouse.name is what we're exercising, so a mock can't verify it.

import { describe, it, expect, beforeEach, afterAll } from "vitest";
import prisma from "../../src/db.js";
import { createWarehouse } from "../../src/services/warehouse.service.js";
import { AppError } from "../../src/errors/app-error.js";

beforeEach(async () => {
  // Clean slate — order matters for FK constraints.
  await prisma.purchaseOrderLine.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.warehouse.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("createWarehouse", () => {
  it("rejects a duplicate name with a 409 conflict, not an unhandled database error", async () => {
    await createWarehouse({ name: "Main Warehouse" });

    const attempt = createWarehouse({ name: "Main Warehouse" });
    await expect(attempt).rejects.toThrow(AppError);
    await expect(attempt).rejects.toMatchObject({ statusCode: 409 });
  });
});
