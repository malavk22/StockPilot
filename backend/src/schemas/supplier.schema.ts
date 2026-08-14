// server/src/schemas/supplier.schema.ts
import { z } from "zod";

export const createSupplierSchema = z.object({
  name: z.string().trim().min(1).max(200),
  contactEmail: z.string().trim().email().max(200).optional(),
  contactPhone: z.string().trim().max(50).optional(),
});

export const updateSupplierSchema = createSupplierSchema.partial();
