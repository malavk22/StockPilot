// server/src/controllers/stock.controller.ts

import type { Request, Response } from "express";
import { z } from "zod";
import { asyncHandler } from "../middlewares/async-handler.js";
import { HTTP_STATUS } from "../constants/http-status.js";
import * as stockService from "../services/stock.service.js";
import { createStockMovementSchema } from "../schemas/stock-movement.schema.js";

export const createMovement = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as z.infer<typeof createStockMovementSchema>;
  const movement = await stockService.recordMovement(body, req.auth.userId);
  res.status(HTTP_STATUS.CREATED).json(movement);
});

export const getMovements = asyncHandler(async (req: Request, res: Response) => {
  const { productId, warehouseId } = req.query;
  const movements = await stockService.listMovements({
    productId: typeof productId === "string" ? productId : undefined,
    warehouseId: typeof warehouseId === "string" ? warehouseId : undefined,
  });
  res.status(HTTP_STATUS.OK).json(movements);
});
