// client/src/pages/DashboardPage.tsx

import { useEffect, useState, type FormEvent } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from "recharts";
import {
  Boxes,
  Warehouse as WarehouseIcon,
  Layers,
  AlertTriangle,
  Activity,
  Plus,
  PackagePlus,
  ArrowDownCircle,
  ArrowUpCircle,
  Settings2,
  ArrowLeftRight,
  DollarSign,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { getDashboardSummary } from "../api/dashboard.api";
import { getProducts, createProduct } from "../api/product.api";
import { getWarehouses } from "../api/warehouse.api";
import { recordMovement } from "../api/stock.api";
import { getErrorMessage } from "../api/error";
import { formatCurrency } from "../utils/format";
import type { DashboardSummary, MovementType, Product, Warehouse } from "../types";

const MOVEMENT_TYPE_COLORS: Record<string, string> = {
  IN: "var(--color-success)",
  OUT: "var(--color-error)",
  ADJUSTMENT: "var(--color-warning)",
  TRANSFER_IN: "var(--color-primary)",
  TRANSFER_OUT: "var(--color-primary-dark)",
};

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function DashboardPage() {
  const { token, user } = useAuth();
  const { addToast } = useToast();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showRecordMovement, setShowRecordMovement] = useState(false);

  const isAdmin = user?.role === "ADMIN";

  async function refresh() {
    if (!token) return;
    setLoading(true);
    try {
      const [summaryData, productList, warehouseList] = await Promise.all([
        getDashboardSummary(token),
        getProducts(token),
        getWarehouses(token),
      ]);
      setSummary(summaryData);
      setProducts(productList);
      setWarehouses(warehouseList);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (loading) return <p className="page-loading">Loading dashboard…</p>;
  if (!summary) return <div className="alert alert-error">{error || "Failed to load dashboard"}</div>;

  const { kpis, dailyMovements, movementsByType, topProducts, recentActivity } = summary;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">A live view of your inventory across all warehouses.</p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* KPI cards */}
      <div className="kpi-grid">
        <KpiCard icon={<Boxes size={18} />} label="Products" value={kpis.totalProducts} />
        <KpiCard icon={<WarehouseIcon size={18} />} label="Warehouses" value={kpis.totalWarehouses} />
        <KpiCard icon={<Layers size={18} />} label="Total Stock Units" value={kpis.totalStockUnits} />
        <KpiCard
          icon={<DollarSign size={18} />}
          label="Inventory Value"
          value={kpis.totalInventoryValue}
          currency
        />
        <KpiCard
          icon={<AlertTriangle size={18} />}
          label="Low Stock Items"
          value={kpis.lowStockCount}
          tone={kpis.lowStockCount > 0 ? "warning" : "default"}
        />
        <KpiCard icon={<Activity size={18} />} label="Movements Today" value={kpis.movementsToday} />
      </div>

      {/* Charts */}
      <div className="dashboard-grid">
        <div className="card chart-card">
          <h3 className="card-title">Stock Movement Trend (14 days)</h3>
          {dailyMovements.length === 0 ? (
            <p className="empty-state">No movement history yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={dailyMovements}>
                <defs>
                  <linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-success)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--color-success)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorOut" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-error)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--color-error)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d) => d.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="totalIn"
                  name="Stock In"
                  stroke="var(--color-success)"
                  fill="url(#colorIn)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="totalOut"
                  name="Stock Out"
                  stroke="var(--color-error)"
                  fill="url(#colorOut)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card chart-card">
          <h3 className="card-title">Movements by Type</h3>
          {movementsByType.length === 0 ? (
            <p className="empty-state">No movements yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={movementsByType} layout="vertical" margin={{ left: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis type="category" dataKey="type" tick={{ fontSize: 11 }} width={90} />
                <Tooltip />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {movementsByType.map((entry) => (
                    <Cell key={entry.type} fill={MOVEMENT_TYPE_COLORS[entry.type] ?? "var(--color-primary)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Activity + quick actions + top products */}
      <div className="dashboard-grid dashboard-grid--bottom">
        <div className="card">
          <h3 className="card-title">Recent Activity</h3>
          {recentActivity.length === 0 ? (
            <p className="empty-state">No activity yet.</p>
          ) : (
            <ul className="activity-feed">
              {recentActivity.map((m) => (
                <li key={m.id} className="activity-item">
                  <span className={`activity-icon activity-icon--${m.type.toLowerCase()}`}>
                    {m.quantity >= 0 ? <ArrowUpCircle size={16} /> : <ArrowDownCircle size={16} />}
                  </span>
                  <div className="activity-body">
                    <span>
                      <strong>{m.product?.name ?? "Unknown product"}</strong>{" "}
                      {m.quantity >= 0 ? "+" : ""}
                      {m.quantity} {m.type.replace("_", " ").toLowerCase()} at {m.warehouse?.name}
                    </span>
                    <span className="activity-meta">
                      {m.createdBy?.email} · {timeAgo(m.createdAt)}
                      {m.reason ? ` · ${m.reason}` : ""}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="dashboard-side">
          <div className="card">
            <h3 className="card-title">Quick Actions</h3>
            <div className="quick-actions">
              <button className="btn btn-outline" onClick={() => setShowRecordMovement(true)}>
                <PackagePlus size={16} />
                Record Movement
              </button>
              {isAdmin && (
                <button className="btn btn-outline" onClick={() => setShowAddProduct(true)}>
                  <Plus size={16} />
                  Add Product
                </button>
              )}
            </div>
          </div>

          <div className="card">
            <h3 className="card-title">
              <Settings2 size={15} /> Top Products by Volume
            </h3>
            {topProducts.length === 0 ? (
              <p className="empty-state">No data yet.</p>
            ) : (
              <ul className="top-products-list">
                {topProducts.map((p, i) => (
                  <li key={p.id}>
                    <span className="top-products-rank">{i + 1}</span>
                    <span className="top-products-name">{p.name}</span>
                    <span className="top-products-volume">{p.volume}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {showAddProduct && (
        <QuickAddProductModal
          token={token!}
          onClose={() => setShowAddProduct(false)}
          onCreated={() => {
            setShowAddProduct(false);
            addToast("Product added");
            refresh();
          }}
        />
      )}

      {showRecordMovement && (
        <QuickRecordMovementModal
          token={token!}
          products={products}
          warehouses={warehouses}
          onClose={() => setShowRecordMovement(false)}
          onRecorded={() => {
            setShowRecordMovement(false);
            addToast("Movement recorded");
            refresh();
          }}
        />
      )}
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  tone = "default",
  currency = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone?: "default" | "warning";
  currency?: boolean;
}) {
  return (
    <div className={`kpi-card ${tone === "warning" ? "kpi-card--warning" : ""}`}>
      <div className="kpi-icon">{icon}</div>
      <div>
        <div className="kpi-value">{currency ? formatCurrency(value) : value.toLocaleString()}</div>
        <div className="kpi-label">{label}</div>
      </div>
    </div>
  );
}

function QuickAddProductModal({
  token,
  onClose,
  onCreated,
}: {
  token: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState(0);
  const [lowStockThreshold, setLowStockThreshold] = useState(5);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await createProduct(token, { sku, name, price, lowStockThreshold });
      onCreated();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal-card" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h3>Add Product</h3>
        {error && <div className="alert alert-error">{error}</div>}
        <label>
          SKU
          <input value={sku} onChange={(e) => setSku(e.target.value)} required />
        </label>
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label>
          Unit price
          <input
            type="number"
            min={0}
            step="0.01"
            value={price}
            onChange={(e) => setPrice(Number(e.target.value))}
          />
        </label>
        <label>
          Low stock threshold
          <input
            type="number"
            min={0}
            value={lowStockThreshold}
            onChange={(e) => setLowStockThreshold(Number(e.target.value))}
          />
        </label>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Adding..." : "Add product"}
          </button>
        </div>
      </form>
    </div>
  );
}

function QuickRecordMovementModal({
  token,
  products,
  warehouses,
  onClose,
  onRecorded,
}: {
  token: string;
  products: Product[];
  warehouses: Warehouse[];
  onClose: () => void;
  onRecorded: () => void;
}) {
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [type, setType] = useState<MovementType>("IN");
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!productId) {
      setError("Add a product first.");
      return;
    }
    if (type === "ADJUSTMENT" && !reason.trim()) {
      setError("A reason is required for manual adjustments.");
      return;
    }

    setSubmitting(true);
    try {
      await recordMovement(token, {
        type: type as "IN" | "OUT" | "ADJUSTMENT",
        productId,
        warehouseId,
        quantity: type === "ADJUSTMENT" ? quantity : Math.abs(quantity),
        reason: reason || undefined,
      });
      onRecorded();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal-card" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h3>
          <ArrowLeftRight size={16} /> Record Movement
        </h3>
        {error && <div className="alert alert-error">{error}</div>}

        <label>
          Product
          <select value={productId} onChange={(e) => setProductId(e.target.value)} required>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.sku})
              </option>
            ))}
          </select>
        </label>

        <label>
          Type
          <select value={type} onChange={(e) => setType(e.target.value as MovementType)}>
            <option value="IN">Stock In (received)</option>
            <option value="OUT">Stock Out (sold/used)</option>
            <option value="ADJUSTMENT">Adjustment (correction)</option>
          </select>
        </label>

        <label>
          Warehouse
          <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} required>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          {type === "ADJUSTMENT" ? "Quantity delta (+/-)" : "Quantity"}
          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            required
          />
        </label>

        <label>
          Reason {type === "ADJUSTMENT" && "(required)"}
          <input value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
