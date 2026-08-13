// server/src/routes/dashboard.routes.ts

import { Router } from "express";
import * as dashboardController from "../controllers/dashboard.controller.js";

const router = Router();

// Any authenticated user (Admin or Staff) can view dashboard analytics.
router.get("/summary", dashboardController.getSummary);

export default router;
