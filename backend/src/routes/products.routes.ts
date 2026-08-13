// server/src/routes/products.routes.ts

import { Router } from "express";
import * as productController from "../controllers/product.controller.js";
import { validate } from "../middlewares/validate.js";
import { requireAnyRole } from "../middlewares/auth.middleware.js";
import { createProductSchema } from "../schemas/product.schema.js";

const router = Router();

router.get("/", productController.getProducts);
router.get("/low-stock", productController.getLowStockProducts);
router.get("/:id", productController.getProductById);

// Only Admins define the product catalog (SKUs, thresholds); Staff record
// stock movements against existing products but don't create new ones.
router.post(
  "/",
  requireAnyRole(["ADMIN"]),
  validate(createProductSchema),
  productController.createProduct
);

export default router;
