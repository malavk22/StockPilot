// Domain types — single source of truth for API shapes, mirrors the backend.

export type Role = "ADMIN" | "STAFF";

export interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: Role;
}

export interface Warehouse {
  id: string;
  name: string;
  location: string | null;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  unit: string;
  price: string; // Decimal serializes as a string
  lowStockThreshold: number;
  currentStock: number;
  value: number;
}

export interface ProductDetail extends Product {
  stockByWarehouse: Array<{ warehouseId: string; warehouseName: string; quantity: number }>;
}

export type MovementType = "IN" | "OUT" | "ADJUSTMENT" | "TRANSFER_IN" | "TRANSFER_OUT";

export interface StockMovement {
  id: string;
  productId: string;
  warehouseId: string;
  type: MovementType;
  quantity: number;
  reason: string | null;
  createdAt: string;
  product?: { id: string; sku: string; name: string };
  warehouse?: { id: string; name: string };
  createdBy?: { id: string; email: string };
}

export interface ApiError {
  errorCode: string;
  message: string;
  details?: Record<string, string>;
}

export interface DashboardSummary {
  kpis: {
    totalProducts: number;
    totalWarehouses: number;
    totalStockUnits: number;
    totalInventoryValue: number;
    lowStockCount: number;
    movementsToday: number;
  };
  movementsByType: Array<{ type: MovementType; count: number }>;
  dailyMovements: Array<{ date: string; totalIn: number; totalOut: number }>;
  topProducts: Array<{ id: string; sku: string; name: string; volume: number }>;
  recentActivity: StockMovement[];
}
