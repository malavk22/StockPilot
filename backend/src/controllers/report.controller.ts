// server/src/controllers/report.controller.ts

import type { Request, Response } from "express";
import { asyncHandler } from "../middlewares/async-handler.js";
import { generateInventoryReportPdf } from "../services/report.service.js";

export const getInventoryReport = asyncHandler(async (_req: Request, res: Response) => {
  const pdf = await generateInventoryReportPdf();
  const filename = `stockpilot-inventory-report-${new Date().toISOString().slice(0, 10)}.pdf`;

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-Length", String(pdf.length));
  res.send(pdf);
});
