// server/src/routes/warehouses.routes.ts

import { Router } from "express";
import * as warehouseController from "../controllers/warehouse.controller.js";
import { validate } from "../middlewares/validate.js";
import { requireAnyRole } from "../middlewares/auth.middleware.js";
import { createWarehouseSchema } from "../schemas/warehouse.schema.js";

const router = Router();

// Any authenticated user can see where stock lives.
router.get("/", warehouseController.getWarehouses);

// Only Admins create/manage warehouses — Staff shouldn't be able to spin up
// a new location on their own.
router.post(
  "/",
  requireAnyRole(["ADMIN"]),
  validate(createWarehouseSchema),
  warehouseController.createWarehouse
);

export default router;
