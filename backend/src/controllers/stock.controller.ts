// server/src/controllers/stock.controller.ts

import type { Request, Response } from "express";
import { z } from "zod";
import type { MovementType } from "@prisma/client";
import { asyncHandler } from "../middlewares/async-handler.js";
import { HTTP_STATUS } from "../constants/http-status.js";
import * as stockService from "../services/stock.service.js";
import { createStockMovementSchema, transferStockSchema } from "../schemas/stock-movement.schema.js";

const VALID_MOVEMENT_TYPES: ReadonlySet<string> = new Set([
  "IN",
  "OUT",
  "ADJUSTMENT",
  "TRANSFER_IN",
  "TRANSFER_OUT",
]);

export const createMovement = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as z.infer<typeof createStockMovementSchema>;
  const movement = await stockService.recordMovement(body, req.auth.userId);
  res.status(HTTP_STATUS.CREATED).json(movement);
});

export const transferStock = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as z.infer<typeof transferStockSchema>;
  const result = await stockService.transferStock(body, req.auth.userId);
  res.status(HTTP_STATUS.CREATED).json(result);
});

export const getMovements = asyncHandler(async (req: Request, res: Response) => {
  const { productId, warehouseId, type, limit } = req.query;
  const typeFilter =
    typeof type === "string" && VALID_MOVEMENT_TYPES.has(type) ? (type as MovementType) : undefined;

  const movements = await stockService.listMovements({
    productId: typeof productId === "string" ? productId : undefined,
    warehouseId: typeof warehouseId === "string" ? warehouseId : undefined,
    type: typeFilter,
    limit: typeof limit === "string" ? Number(limit) : undefined,
  });
  res.status(HTTP_STATUS.OK).json(movements);
});
