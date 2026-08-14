// server/src/controllers/purchase-order.controller.ts

import type { Request, Response } from "express";
import { z } from "zod";
import type { PurchaseOrderStatus } from "@prisma/client";
import { asyncHandler } from "../middlewares/async-handler.js";
import { HTTP_STATUS } from "../constants/http-status.js";
import * as poService from "../services/purchase-order.service.js";
import { createPurchaseOrderSchema } from "../schemas/purchase-order.schema.js";

const VALID_STATUSES: ReadonlySet<string> = new Set(["DRAFT", "SUBMITTED", "RECEIVED", "CANCELLED"]);

/** Attaches the human-readable "PO-00001" label derived from the DB sequence. */
function withPoNumber<T extends { sequenceNumber: number }>(po: T) {
  return { ...po, poNumber: `PO-${String(po.sequenceNumber).padStart(5, "0")}` };
}

export const getPurchaseOrders = asyncHandler(async (req: Request, res: Response) => {
  const { status, supplierId } = req.query;
  const statusFilter =
    typeof status === "string" && VALID_STATUSES.has(status) ? (status as PurchaseOrderStatus) : undefined;

  const orders = await poService.listPurchaseOrders({
    status: statusFilter,
    supplierId: typeof supplierId === "string" ? supplierId : undefined,
  });
  res.status(HTTP_STATUS.OK).json(orders.map(withPoNumber));
});

export const getPurchaseOrderById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const po = await poService.getPurchaseOrderOrThrow(id as string);
  res.status(HTTP_STATUS.OK).json(withPoNumber(po));
});

export const createPurchaseOrder = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as z.infer<typeof createPurchaseOrderSchema>;
  const po = await poService.createPurchaseOrder(body, req.auth.userId);
  res.status(HTTP_STATUS.CREATED).json(withPoNumber(po));
});

export const submitPurchaseOrder = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const po = await poService.submitPurchaseOrder(id as string, req.auth.userId);
  res.status(HTTP_STATUS.OK).json(withPoNumber(po));
});

export const receivePurchaseOrder = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const po = await poService.receivePurchaseOrder(id as string, req.auth.userId);
  res.status(HTTP_STATUS.OK).json(withPoNumber(po));
});

export const cancelPurchaseOrder = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const po = await poService.cancelPurchaseOrder(id as string, req.auth.userId);
  res.status(HTTP_STATUS.OK).json(withPoNumber(po));
});
