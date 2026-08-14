// server/src/app.ts

import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import { httpConfig } from "./config/http.config.js";
import prisma from "./db.js";
import authRoutes from "./routes/auth.routes.js";
import warehouseRoutes from "./routes/warehouses.routes.js";
import productRoutes from "./routes/products.routes.js";
import stockMovementRoutes from "./routes/stock-movements.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import supplierRoutes from "./routes/suppliers.routes.js";
import purchaseOrderRoutes from "./routes/purchase-orders.routes.js";
import reportRoutes from "./routes/reports.routes.js";
import { errorHandler } from "./middlewares/error-handler.js";
import { authMiddleware } from "./middlewares/auth.middleware.js";

const app = express();

app.use(helmet());
app.use(cors(httpConfig.cors));
app.use(express.json({ limit: httpConfig.bodyLimit }));

// Throttle auth endpoints to blunt brute-force / credential stuffing.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { errorCode: "RATE_LIMITED", message: "Too many attempts, please try again later" },
});

app.get("/health", async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ status: "ok" });
});

app.use("/auth", authLimiter, authRoutes);

// Protected routes — JWT required from here on.
app.use(authMiddleware);
app.use("/warehouses", warehouseRoutes);
app.use("/products", productRoutes);
app.use("/stock-movements", stockMovementRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/suppliers", supplierRoutes);
app.use("/purchase-orders", purchaseOrderRoutes);
app.use("/reports", reportRoutes);

app.use(errorHandler);

export default app;
