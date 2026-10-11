// server/src/controllers/product.controller.ts

import type { Request, Response } from "express";
import { z } from "zod";
import { asyncHandler } from "../middlewares/async-handler.js";
import { HTTP_STATUS } from "../constants/http-status.js";
import * as productService from "../services/product.service.js";
import * as stockService from "../services/stock.service.js";
import { createProductSchema } from "../schemas/product.schema.js";
import { roundToCents } from "../utils/money.js";

export const getProducts = asyncHandler(async (_req: Request, res: Response) => {
  const [products, stockByProduct] = await Promise.all([
    productService.listProducts(),
    stockService.getCurrentStockByProduct(),
  ]);

  // Attach current stock (summed across warehouses) to each product so the
  // frontend doesn't need a second round-trip per product just to render a list.
  const withStock = products.map((p) => {
    const currentStock = stockByProduct.get(p.id) ?? 0;
    return { ...p, currentStock, value: roundToCents(Number(p.price) * currentStock) };
  });

  res.status(HTTP_STATUS.OK).json(withStock);
});

export const createProduct = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as z.infer<typeof createProductSchema>;
  const product = await productService.createProduct(body);
  res.status(HTTP_STATUS.CREATED).json(product);
});

export const getProductById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const product = await productService.getProductOrThrow(id as string);
  const [currentStock, stockByWarehouse] = await Promise.all([
    stockService.getCurrentStock(product.id),
    stockService.getStockByWarehouse(product.id),
  ]);
  const value = roundToCents(Number(product.price) * currentStock);
  res.status(HTTP_STATUS.OK).json({ ...product, currentStock, stockByWarehouse, value });
});

export const getLowStockProducts = asyncHandler(async (_req: Request, res: Response) => {
  const products = await stockService.getLowStockProducts();
  res.status(HTTP_STATUS.OK).json(products);
});
