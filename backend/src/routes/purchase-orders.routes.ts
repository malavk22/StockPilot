// server/src/routes/purchase-orders.routes.ts

import { Router } from "express";
import * as poController from "../controllers/purchase-order.controller.js";
import { validate } from "../middlewares/validate.js";
import { createPurchaseOrderSchema } from "../schemas/purchase-order.schema.js";

const router = Router();

// Both roles can raise, submit, receive and cancel purchase orders — same
// reasoning as stock movements: this is day-to-day warehouse operation,
// not catalog management.
router.get("/", poController.getPurchaseOrders);
router.get("/:id", poController.getPurchaseOrderById);
router.post("/", validate(createPurchaseOrderSchema), poController.createPurchaseOrder);
router.post("/:id/submit", poController.submitPurchaseOrder);
router.post("/:id/receive", poController.receivePurchaseOrder);
router.post("/:id/cancel", poController.cancelPurchaseOrder);

export default router;
