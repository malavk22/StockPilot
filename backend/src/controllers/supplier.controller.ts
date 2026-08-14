// server/src/controllers/supplier.controller.ts

import type { Request, Response } from "express";
import { z } from "zod";
import { asyncHandler } from "../middlewares/async-handler.js";
import { HTTP_STATUS } from "../constants/http-status.js";
import * as supplierService from "../services/supplier.service.js";
import { createSupplierSchema } from "../schemas/supplier.schema.js";

export const getSuppliers = asyncHandler(async (_req: Request, res: Response) => {
  const suppliers = await supplierService.listSuppliers();
  res.status(HTTP_STATUS.OK).json(suppliers);
});

export const createSupplier = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as z.infer<typeof createSupplierSchema>;
  const supplier = await supplierService.createSupplier(body);
  res.status(HTTP_STATUS.CREATED).json(supplier);
});
