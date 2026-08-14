// server/src/routes/suppliers.routes.ts

import { Router } from "express";
import * as supplierController from "../controllers/supplier.controller.js";
import { validate } from "../middlewares/validate.js";
import { requireAnyRole } from "../middlewares/auth.middleware.js";
import { createSupplierSchema } from "../schemas/supplier.schema.js";

const router = Router();

// Any authenticated user can see who supplies what.
router.get("/", supplierController.getSuppliers);

// Only Admins manage the supplier list.
router.post(
  "/",
  requireAnyRole(["ADMIN"]),
  validate(createSupplierSchema),
  supplierController.createSupplier
);

export default router;
