// client/src/pages/LedgerPage.tsx
//
// Dedicated global ledger — every stock movement across every product and
// warehouse, filterable. Complements the scattered per-product views with
// a single audit trail.

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BookText } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getMovements } from "../api/stock.api";
import { getProducts } from "../api/product.api";
import { getWarehouses } from "../api/warehouse.api";
import { getErrorMessage } from "../api/error";
import type { MovementType, Product, StockMovement, Warehouse } from "../types";

const TYPE_FILTERS: Array<{ value: MovementType | "ALL"; label: string }> = [
  { value: "ALL", label: "All types" },
  { value: "IN", label: "Stock In" },
  { value: "OUT", label: "Stock Out" },
  { value: "ADJUSTMENT", label: "Adjustment" },
  { value: "TRANSFER_IN", label: "Transfer In" },
  { value: "TRANSFER_OUT", label: "Transfer Out" },
];

export default function LedgerPage() {
  const { token } = useAuth();

  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [typeFilter, setTypeFilter] = useState<MovementType | "ALL">("ALL");
  const [productFilter, setProductFilter] = useState("ALL");
  const [warehouseFilter, setWarehouseFilter] = useState("ALL");

  async function refresh() {
    if (!token) return;
    setLoading(true);
    try {
      const [movementList, productList, warehouseList] = await Promise.all([
        getMovements(token, {
          type: typeFilter === "ALL" ? undefined : typeFilter,
          productId: productFilter === "ALL" ? undefined : productFilter,
          warehouseId: warehouseFilter === "ALL" ? undefined : warehouseFilter,
          limit: 200,
        }),
        getProducts(token),
        getWarehouses(token),
      ]);
      setMovements(movementList);
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
  }, [token, typeFilter, productFilter, warehouseFilter]);

  if (loading && movements.length === 0) return <p className="page-loading">Loading ledger…</p>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <BookText size={22} style={{ verticalAlign: "-3px", marginRight: 8 }} />
            Ledger
          </h1>
          <p className="page-subtitle">
            Full audit trail of every stock movement — append-only, nothing is ever edited or deleted.
          </p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <div className="card-title-row">
          <h3 className="card-title">All Movements ({movements.length})</h3>
          <div className="row-actions">
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
            <select
              className="filter-select"
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
            >
              <option value="ALL">All products</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <select
              className="filter-select"
              value={warehouseFilter}
              onChange={(e) => setWarehouseFilter(e.target.value)}
            >
              <option value="ALL">All warehouses</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {movements.length === 0 ? (
          <p className="empty-state">No movements match these filters.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Product</th>
                <th>Type</th>
                <th>Qty</th>
                <th>Warehouse</th>
                <th>By</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id}>
                  <td className="mono">{new Date(m.createdAt).toLocaleString()}</td>
                  <td>
                    {m.product ? (
                      <Link to={`/products/${m.product.id}`} className="table-link">
                        {m.product.name}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
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
    </div>
  );
}
