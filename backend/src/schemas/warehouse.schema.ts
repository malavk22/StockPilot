// server/src/schemas/warehouse.schema.ts
import { z } from "zod";

export const createWarehouseSchema = z.object({
  name: z.string().trim().min(1).max(200),
  location: z.string().trim().max(300).optional(),
});

export const updateWarehouseSchema = createWarehouseSchema.partial();
