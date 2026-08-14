// server/src/schemas/purchase-order.schema.ts
import { z } from "zod";

const lineSchema = z.object({
  productId: z.string().uuid("Invalid product id"),
  quantityOrdered: z.number().int().positive("Quantity must be a positive integer"),
  unitCost: z.number().min(0, "Unit cost cannot be negative"),
});

export const createPurchaseOrderSchema = z.object({
  supplierId: z.string().uuid("Invalid supplier id"),
  warehouseId: z.string().uuid("Invalid warehouse id"),
  notes: z.string().trim().max(1000).optional(),
  lines: z.array(lineSchema).min(1, "A purchase order needs at least one line item"),
});
