// server/src/routes/stock-movements.routes.ts

import { Router } from "express";
import * as stockController from "../controllers/stock.controller.js";
import { validate } from "../middlewares/validate.js";
import { createStockMovementSchema } from "../schemas/stock-movement.schema.js";

const router = Router();

// Both roles can record and view movements — this is the day-to-day
// operational action (receiving stock, recording a sale). Restricting it to
// Admins would make the app useless for actual warehouse staff.
router.get("/", stockController.getMovements);
router.post("/", validate(createStockMovementSchema), stockController.createMovement);

export default router;
