// client/src/pages/ProductDetailPage.tsx

import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, PackagePlus, ArrowLeftRight, Warehouse as WarehouseIcon } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { getProductById } from "../api/product.api";
import { getWarehouses } from "../api/warehouse.api";
import { getMovements } from "../api/stock.api";
import { getErrorMessage } from "../api/error";
import { formatCurrency } from "../utils/format";
import { MovementFormModal } from "../components/MovementFormModal";
import { TransferFormModal } from "../components/TransferFormModal";
import type { MovementType, ProductDetail, StockMovement, Warehouse } from "../types";

const TYPE_FILTERS: Array<{ value: MovementType | "ALL"; label: string }> = [
  { value: "ALL", label: "All types" },
  { value: "IN", label: "Stock In" },
  { value: "OUT", label: "Stock Out" },
  { value: "ADJUSTMENT", label: "Adjustment" },
  { value: "TRANSFER_IN", label: "Transfer In" },
  { value: "TRANSFER_OUT", label: "Transfer Out" },
];

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const { addToast } = useToast();

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [typeFilter, setTypeFilter] = useState<MovementType | "ALL">("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showMovement, setShowMovement] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);

  async function refresh() {
    if (!token || !id) return;
    setLoading(true);
    try {
      const [productData, movementList, warehouseList] = await Promise.all([
        getProductById(token, id),
        getMovements(token, { productId: id }),
        getWarehouses(token),
      ]);
      setProduct(productData);
      setMovements(movementList);
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
  }, [token, id]);

  if (loading) return <p className="page-loading">Loading product…</p>;
  if (!product) return <div className="alert alert-error">{error || "Product not found"}</div>;

  const filteredMovements =
    typeFilter === "ALL" ? movements : movements.filter((m) => m.type === typeFilter);
  const isLowStock = product.currentStock <= product.lowStockThreshold;

  return (
    <div>
      <Link to="/products" className="back-link">
        <ArrowLeft size={14} /> Back to Products
      </Link>

      <div className="page-header">
        <div>
          <h1 className="page-title">{product.name}</h1>
          <p className="page-subtitle mono">
            {product.sku} · {product.unit}
            {product.description ? ` · ${product.description}` : ""}
          </p>
        </div>
        <div className="row-actions">
          <button className="btn btn-outline" onClick={() => setShowMovement(true)}>
            <PackagePlus size={16} />
            Record Movement
          </button>
          <button className="btn btn-outline" onClick={() => setShowTransfer(true)}>
            <ArrowLeftRight size={16} />
            Transfer
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="kpi-grid">
        <div className={`kpi-card ${isLowStock ? "kpi-card--warning" : ""}`}>
          <div>
            <div className="kpi-value">{product.currentStock}</div>
            <div className="kpi-label">Total Stock ({product.unit})</div>
          </div>
        </div>
        <div className="kpi-card">
          <div>
            <div className="kpi-value">{formatCurrency(product.price)}</div>
            <div className="kpi-label">Unit Price</div>
          </div>
        </div>
        <div className="kpi-card">
          <div>
            <div className="kpi-value">{formatCurrency(product.value)}</div>
            <div className="kpi-label">Inventory Value</div>
          </div>
        </div>
        <div className="kpi-card">
          <div>
            <div className="kpi-value">{product.lowStockThreshold}</div>
            <div className="kpi-label">Low Stock Threshold</div>
          </div>
        </div>
      </div>

      <div className="dashboard-grid dashboard-grid--bottom">
        <div className="card">
          <div className="card-title-row">
            <h3 className="card-title">Movement History</h3>
            <select
              className="filter-select"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as MovementType | "ALL")}
            >
              {TYPE_FILTERS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          {filteredMovements.length === 0 ? (
            <p className="empty-state">No movements match this filter.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Qty</th>
                  <th>Warehouse</th>
                  <th>By</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {filteredMovements.map((m) => (
                  <tr key={m.id}>
                    <td className="mono">{new Date(m.createdAt).toLocaleString()}</td>
                    <td>
                      <span className={`type-pill type-pill--${m.type.toLowerCase()}`}>
                        {m.type.replace("_", " ")}
                      </span>
                    </td>
                    <td className="mono">
                      {m.quantity >= 0 ? "+" : ""}
                      {m.quantity}
                    </td>
                    <td>{m.warehouse?.name}</td>
                    <td>{m.createdBy?.email}</td>
                    <td className="text-muted">{m.reason ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <h3 className="card-title">
            <WarehouseIcon size={15} /> Stock by Warehouse
          </h3>
          {product.stockByWarehouse.length === 0 ? (
            <p className="empty-state">No stock recorded yet.</p>
          ) : (
            <ul className="top-products-list">
              {product.stockByWarehouse.map((w) => (
                <li key={w.warehouseId}>
                  <span className="top-products-name">{w.warehouseName}</span>
                  <span className="top-products-volume">
                    {w.quantity} {product.unit}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {showMovement && (
        <MovementFormModal
          token={token!}
          product={product}
          warehouses={warehouses}
          onClose={() => setShowMovement(false)}
          onRecorded={() => {
            setShowMovement(false);
            addToast("Movement recorded");
            refresh();
          }}
        />
      )}

      {showTransfer && (
        <TransferFormModal
          token={token!}
          product={product}
          warehouses={warehouses}
          onClose={() => setShowTransfer(false)}
          onTransferred={() => {
            setShowTransfer(false);
            addToast("Stock transferred");
            refresh();
          }}
        />
      )}
    </div>
  );
}
