// server/src/schemas/stock-movement.schema.ts
import { z } from "zod";

const base = {
  productId: z.string().uuid("Invalid product id"),
  warehouseId: z.string().uuid("Invalid warehouse id"),
};

// A discriminated union so each movement type gets exactly the validation it
// needs: IN/OUT take a positive magnitude (the service applies the sign);
// ADJUSTMENT takes an explicit signed delta and *requires* a reason, since
// it's a manual override of the ledger and should always be explainable.
export const createStockMovementSchema = z.discriminatedUnion("type", [
  z.object({
    ...base,
    type: z.literal("IN"),
    quantity: z.number().int().positive("Quantity must be a positive integer"),
    reason: z.string().trim().max(500).optional(),
  }),
  z.object({
    ...base,
    type: z.literal("OUT"),
    quantity: z.number().int().positive("Quantity must be a positive integer"),
    reason: z.string().trim().max(500).optional(),
  }),
  z.object({
    ...base,
    type: z.literal("ADJUSTMENT"),
    quantity: z
      .number()
      .int()
      .refine((q) => q !== 0, "Adjustment quantity cannot be zero"),
    reason: z.string().trim().min(1, "A reason is required for manual adjustments").max(500),
  }),
]);

export const transferStockSchema = z
  .object({
    productId: z.string().uuid("Invalid product id"),
    fromWarehouseId: z.string().uuid("Invalid source warehouse id"),
    toWarehouseId: z.string().uuid("Invalid destination warehouse id"),
    quantity: z.number().int().positive("Quantity must be a positive integer"),
    reason: z.string().trim().max(500).optional(),
  })
  .refine((data) => data.fromWarehouseId !== data.toWarehouseId, {
    message: "Source and destination warehouse must be different",
    path: ["toWarehouseId"],
  });
