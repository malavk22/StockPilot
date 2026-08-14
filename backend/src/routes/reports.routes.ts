// server/src/routes/reports.routes.ts

import { Router } from "express";
import * as reportController from "../controllers/report.controller.js";

const router = Router();

// Any authenticated user can pull a snapshot report.
router.get("/inventory", reportController.getInventoryReport);

export default router;
