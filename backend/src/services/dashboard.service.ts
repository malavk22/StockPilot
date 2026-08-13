// server/src/services/dashboard.service.ts
//
// Aggregation queries for the dashboard. Kept separate from the
// product/warehouse/stock services because this is a distinct concern
// (read-only reporting across entities) rather than owning any one of them.

import prisma from "../db.js";
import { getLowStockProducts } from "./stock.service.js";

export interface DashboardSummary {
  kpis: {
    totalProducts: number;
    totalWarehouses: number;
    totalStockUnits: number;
    lowStockCount: number;
    movementsToday: number;
  };
  movementsByType: Array<{ type: string; count: number }>;
  dailyMovements: Array<{ date: string; totalIn: number; totalOut: number }>;
  topProducts: Array<{ id: string; sku: string; name: string; volume: number }>;
  recentActivity: Awaited<ReturnType<typeof getRecentActivity>>;
}

function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

async function getKpis() {
  const [totalProducts, totalWarehouses, stockAgg, lowStock, movementsToday] = await Promise.all([
    prisma.product.count({ where: { deletedAt: null } }),
    prisma.warehouse.count({ where: { deletedAt: null } }),
    // Sum of every signed movement = total units currently in inventory.
    // Transfers net to zero (a TRANSFER_OUT and its paired TRANSFER_IN
    // cancel out), so this correctly reflects real stock, not "activity".
    prisma.stockMovement.aggregate({ _sum: { quantity: true } }),
    getLowStockProducts(),
    prisma.stockMovement.count({ where: { createdAt: { gte: startOfTodayUtc() } } }),
  ]);

  return {
    totalProducts,
    totalWarehouses,
    totalStockUnits: stockAgg._sum.quantity ?? 0,
    lowStockCount: lowStock.length,
    movementsToday,
  };
}

async function getMovementsByType() {
  const rows = await prisma.stockMovement.groupBy({
    by: ["type"],
    _count: { _all: true },
  });
  return rows.map((r) => ({ type: r.type, count: r._count._all }));
}

/** Daily IN vs OUT volume for the last 14 days — feeds a trend chart. */
async function getDailyMovements() {
  const rows = await prisma.$queryRaw<Array<{ date: Date; totalIn: bigint; totalOut: bigint }>>`
    SELECT
      DATE("createdAt") AS date,
      COALESCE(SUM(CASE WHEN quantity > 0 THEN quantity ELSE 0 END), 0) AS "totalIn",
      COALESCE(SUM(CASE WHEN quantity < 0 THEN -quantity ELSE 0 END), 0) AS "totalOut"
    FROM "StockMovement"
    WHERE "createdAt" >= NOW() - INTERVAL '14 days'
    GROUP BY DATE("createdAt")
    ORDER BY date ASC;
  `;

  return rows.map((r) => ({
    date: r.date.toISOString().slice(0, 10),
    totalIn: Number(r.totalIn),
    totalOut: Number(r.totalOut),
  }));
}

/** Top 5 products by total movement volume (|quantity| summed) — busiest items. */
async function getTopProducts() {
  const rows = await prisma.$queryRaw<Array<{ id: string; sku: string; name: string; volume: bigint }>>`
    SELECT p.id, p.sku, p.name, SUM(ABS(sm.quantity)) AS volume
    FROM "StockMovement" sm
    JOIN "Product" p ON p.id = sm."productId"
    WHERE p."deletedAt" IS NULL
    GROUP BY p.id
    ORDER BY volume DESC
    LIMIT 5;
  `;

  return rows.map((r) => ({ ...r, volume: Number(r.volume) }));
}

async function getRecentActivity() {
  return prisma.stockMovement.findMany({
    take: 10,
    orderBy: { createdAt: "desc" },
    include: {
      product: { select: { id: true, sku: true, name: true } },
      warehouse: { select: { id: true, name: true } },
      createdBy: { select: { id: true, email: true } },
    },
  });
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const [kpis, movementsByType, dailyMovements, topProducts, recentActivity] = await Promise.all([
    getKpis(),
    getMovementsByType(),
    getDailyMovements(),
    getTopProducts(),
    getRecentActivity(),
  ]);

  return { kpis, movementsByType, dailyMovements, topProducts, recentActivity };
}
