// client/src/pages/ProductsPage.tsx

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, ArrowLeftRight, PackagePlus } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { getProducts } from "../api/product.api";
import { getWarehouses } from "../api/warehouse.api";
import { getErrorMessage } from "../api/error";
import { formatCurrency } from "../utils/format";
import { AddProductModal } from "../components/AddProductModal";
import { MovementFormModal } from "../components/MovementFormModal";
import { TransferFormModal } from "../components/TransferFormModal";
import type { Product, Warehouse } from "../types";

export default function ProductsPage() {
  const { token, user } = useAuth();
  const { addToast } = useToast();
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
          <button className="btn btn-primary" onClick={() => setShowAddProduct(true)}>
            <Plus size={16} />
            Add Product
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

      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Name</th>
              <th>Stock</th>
              <th>Price</th>
              <th>Value</th>
              <th>Threshold</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className={p.currentStock <= p.lowStockThreshold ? "row-low-stock" : ""}>
                <td className="mono">{p.sku}</td>
                <td>
                  <Link to={`/products/${p.id}`} className="table-link">
                    {p.name}
                  </Link>
                </td>
                <td className="mono">
                  {p.currentStock} {p.unit}
                </td>
                <td className="mono">{formatCurrency(p.price)}</td>
                <td className="mono">{formatCurrency(p.value)}</td>
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
                <td colSpan={7} className="empty-state">
                  No products yet{isAdmin ? " — add one above." : "."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {movementTarget && (
        <MovementFormModal
          token={token!}
          product={movementTarget}
          warehouses={warehouses}
          onClose={() => setMovementTarget(null)}
          onRecorded={() => {
            setMovementTarget(null);
            addToast("Movement recorded");
            refresh();
          }}
        />
      )}

      {transferTarget && (
        <TransferFormModal
          token={token!}
          product={transferTarget}
          warehouses={warehouses}
          onClose={() => setTransferTarget(null)}
          onTransferred={() => {
            setTransferTarget(null);
            addToast("Stock transferred");
            refresh();
          }}
        />
      )}

      {showAddProduct && (
        <AddProductModal
          token={token!}
          onClose={() => setShowAddProduct(false)}
          onCreated={() => {
            setShowAddProduct(false);
            addToast("Product added");
            refresh();
          }}
        />
      )}
    </div>
  );
}
