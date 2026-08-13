// client/src/pages/DashboardPage.tsx

import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../context/AuthContext";
import { getProducts, createProduct } from "../api/product.api";
import { getWarehouses } from "../api/warehouse.api";
import { recordMovement } from "../api/stock.api";
import { getErrorMessage } from "../api/error";
import type { MovementType, Product, Warehouse } from "../types";

export default function DashboardPage() {
  const { token, user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [movementTarget, setMovementTarget] = useState<Product | null>(null);
  const [showAddProduct, setShowAddProduct] = useState(false);

  const isAdmin = user?.role === "ADMIN";

  async function refresh() {
    if (!token) return;
    setLoading(true);
    try {
      const [productList, warehouseList] = await Promise.all([
        getProducts(token),
        getWarehouses(token),
      ]);
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

  const lowStockProducts = products.filter((p) => p.currentStock <= p.lowStockThreshold);

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <div className="page-header">
        <h2>Products</h2>
        {isAdmin && (
          <button className="btn btn-primary" onClick={() => setShowAddProduct((v) => !v)}>
            {showAddProduct ? "Cancel" : "+ Add Product"}
          </button>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {lowStockProducts.length > 0 && (
        <div className="alert alert-warning">
          ⚠️ {lowStockProducts.length} product{lowStockProducts.length > 1 ? "s" : ""} running low:{" "}
          {lowStockProducts.map((p) => p.name).join(", ")}
        </div>
      )}

      {showAddProduct && (
        <AddProductForm
          token={token!}
          onCreated={() => {
            setShowAddProduct(false);
            refresh();
          }}
          onError={setError}
        />
      )}

      <table className="data-table">
        <thead>
          <tr>
            <th>SKU</th>
            <th>Name</th>
            <th>Stock</th>
            <th>Threshold</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.id} className={p.currentStock <= p.lowStockThreshold ? "row-low-stock" : ""}>
              <td>{p.sku}</td>
              <td>{p.name}</td>
              <td>
                {p.currentStock} {p.unit}
              </td>
              <td>{p.lowStockThreshold}</td>
              <td>
                <button className="btn btn-small" onClick={() => setMovementTarget(p)}>
                  Record movement
                </button>
              </td>
            </tr>
          ))}
          {products.length === 0 && (
            <tr>
              <td colSpan={5} className="empty-state">
                No products yet{isAdmin ? " — add one above." : "."}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {movementTarget && (
        <MovementForm
          token={token!}
          product={movementTarget}
          warehouses={warehouses}
          onClose={() => setMovementTarget(null)}
          onRecorded={() => {
            setMovementTarget(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function AddProductForm({
  token,
  onCreated,
  onError,
}: {
  token: string;
  onCreated: () => void;
  onError: (msg: string) => void;
}) {
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [lowStockThreshold, setLowStockThreshold] = useState(5);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createProduct(token, { sku, name, lowStockThreshold });
      onCreated();
    } catch (err) {
      onError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="inline-form" onSubmit={handleSubmit}>
      <label>
        SKU
        <input value={sku} onChange={(e) => setSku(e.target.value)} required />
      </label>
      <label>
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} required />
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
      <button type="submit" className="btn btn-primary" disabled={submitting}>
        {submitting ? "Adding..." : "Add product"}
      </button>
    </form>
  );
}

function MovementForm({
  token,
  product,
  warehouses,
  onClose,
  onRecorded,
}: {
  token: string;
  product: Product;
  warehouses: Warehouse[];
  onClose: () => void;
  onRecorded: () => void;
}) {
  const [type, setType] = useState<MovementType>("IN");
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (type === "ADJUSTMENT" && !reason.trim()) {
      setError("A reason is required for manual adjustments.");
      return;
    }

    setSubmitting(true);
    try {
      await recordMovement(token, {
        type,
        productId: product.id,
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
        <h3>Record movement — {product.name}</h3>
        <p className="auth-note">Current stock: {product.currentStock}</p>

        {error && <div className="alert alert-error">{error}</div>}

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
