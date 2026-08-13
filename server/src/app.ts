// server/src/app.ts

import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import { httpConfig } from "./config/http.config.js";
import prisma from "./db.js";
import authRoutes from "./routes/auth.routes.js";
import { errorHandler } from "./middlewares/error-handler.js";

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

// Protected routes will be mounted here behind authMiddleware as they're built:
// app.use(authMiddleware);
// app.use('/products', productRoutes);
// app.use('/warehouses', warehouseRoutes);
// app.use('/stock-movements', stockMovementRoutes);

app.use(errorHandler);

export default app;
