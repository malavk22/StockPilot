// server/src/controllers/dashboard.controller.ts

import type { Request, Response } from "express";
import { asyncHandler } from "../middlewares/async-handler.js";
import { HTTP_STATUS } from "../constants/http-status.js";
import { getDashboardSummary } from "../services/dashboard.service.js";

export const getSummary = asyncHandler(async (_req: Request, res: Response) => {
  const summary = await getDashboardSummary();
  res.status(HTTP_STATUS.OK).json(summary);
});
