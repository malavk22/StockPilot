// client/src/pages/ProductsPage.tsx

import { useEffect, useState, type FormEvent } from "react";
import { Plus, ArrowLeftRight, PackagePlus } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getProducts, createProduct } from "../api/product.api";
import { getWarehouses } from "../api/warehouse.api";
import { recordMovement, transferStock } from "../api/stock.api";
import { getErrorMessage } from "../api/error";
import type { MovementType, Product, Warehouse } from "../types";

export default function ProductsPage() {
  const { token, user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [movementTarget, setMovementTarget] = useState<Product | null>(null);
  const [transferTarget, setTransferTarget] = useState<Product | null>(null);
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

  if (loading) return <p className="page-loading">Loading products…</p>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Products</h1>
          <p className="page-subtitle">Manage your catalog and track stock across warehouses.</p>
        </div>
        {isAdmin && (
          <button className="btn btn-primary" onClick={() => setShowAddProduct((v) => !v)}>
            <Plus size={16} />
            {showAddProduct ? "Cancel" : "Add Product"}
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

      <div className="card">
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
                <td className="mono">{p.sku}</td>
                <td>{p.name}</td>
                <td className="mono">
                  {p.currentStock} {p.unit}
                </td>
                <td className="mono">{p.lowStockThreshold}</td>
                <td>
                  <div className="row-actions">
                    <button className="btn btn-small" onClick={() => setMovementTarget(p)}>
                      <PackagePlus size={14} />
                      Movement
                    </button>
                    <button className="btn btn-small btn-outline" onClick={() => setTransferTarget(p)}>
                      <ArrowLeftRight size={14} />
                      Transfer
                    </button>
                  </div>
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
      </div>

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

      {transferTarget && (
        <TransferForm
          token={token!}
          product={transferTarget}
          warehouses={warehouses}
          onClose={() => setTransferTarget(null)}
          onTransferred={() => {
            setTransferTarget(null);
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
    <form className="inline-form card" onSubmit={handleSubmit}>
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
        type: type as "IN" | "OUT" | "ADJUSTMENT",
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

function TransferForm({
  token,
  product,
  warehouses,
  onClose,
  onTransferred,
}: {
  token: string;
  product: Product;
  warehouses: Warehouse[];
  onClose: () => void;
  onTransferred: () => void;
}) {
  const [fromWarehouseId, setFromWarehouseId] = useState(warehouses[0]?.id ?? "");
  const [toWarehouseId, setToWarehouseId] = useState(warehouses[1]?.id ?? warehouses[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const hasEnoughWarehouses = warehouses.length >= 2;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (fromWarehouseId === toWarehouseId) {
      setError("Source and destination warehouse must be different.");
      return;
    }

    setSubmitting(true);
    try {
      await transferStock(token, {
        productId: product.id,
        fromWarehouseId,
        toWarehouseId,
        quantity,
        reason: reason || undefined,
      });
      onTransferred();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal-card" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h3>Transfer stock — {product.name}</h3>
        <p className="auth-note">Total stock across all warehouses: {product.currentStock}</p>

        {error && <div className="alert alert-error">{error}</div>}

        {!hasEnoughWarehouses ? (
          <div className="alert alert-warning">
            You need at least two warehouses to transfer stock between them.
          </div>
        ) : (
          <>
            <label>
              From
              <select value={fromWarehouseId} onChange={(e) => setFromWarehouseId(e.target.value)}>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              To
              <select value={toWarehouseId} onChange={(e) => setToWarehouseId(e.target.value)}>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Quantity
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                required
              />
            </label>

            <label>
              Reason (optional)
              <input value={reason} onChange={(e) => setReason(e.target.value)} />
            </label>
          </>
        )}

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting || !hasEnoughWarehouses}>
            {submitting ? "Transferring..." : "Transfer"}
          </button>
        </div>
      </form>
    </div>
  );
}
