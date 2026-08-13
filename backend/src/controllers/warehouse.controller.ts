// server/src/controllers/warehouse.controller.ts

import type { Request, Response } from "express";
import { z } from "zod";
import { asyncHandler } from "../middlewares/async-handler.js";
import { HTTP_STATUS } from "../constants/http-status.js";
import * as warehouseService from "../services/warehouse.service.js";
import { createWarehouseSchema } from "../schemas/warehouse.schema.js";

export const getWarehouses = asyncHandler(async (_req: Request, res: Response) => {
  const warehouses = await warehouseService.listWarehouses();
  res.status(HTTP_STATUS.OK).json(warehouses);
});

export const createWarehouse = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as z.infer<typeof createWarehouseSchema>;
  const warehouse = await warehouseService.createWarehouse(body);
  res.status(HTTP_STATUS.CREATED).json(warehouse);
});
