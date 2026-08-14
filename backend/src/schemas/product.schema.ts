// server/src/schemas/product.schema.ts
import { z } from "zod";

export const createProductSchema = z.object({
  sku: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  unit: z.string().trim().min(1).max(32).default("unit"),
  price: z.number().min(0).default(0),
  lowStockThreshold: z.number().int().min(0).default(0),
  supplierId: z.string().uuid("Invalid supplier id").optional(),
});

export const updateProductSchema = createProductSchema.partial();
