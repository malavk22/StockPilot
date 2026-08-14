// client/src/pages/PurchaseOrdersPage.tsx

import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { getPurchaseOrders, createPurchaseOrder } from "../api/purchase-order.api";
import { getSuppliers } from "../api/supplier.api";
import { getWarehouses } from "../api/warehouse.api";
import { getProducts } from "../api/product.api";
import { getErrorMessage } from "../api/error";
import { formatCurrency } from "../utils/format";
import type { Product, PurchaseOrder, PurchaseOrderStatus, Supplier, Warehouse } from "../types";

const STATUS_FILTERS: Array<{ value: PurchaseOrderStatus | "ALL"; label: string }> = [
  { value: "ALL", label: "All statuses" },
  { value: "DRAFT", label: "Draft" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "RECEIVED", label: "Received" },
  { value: "CANCELLED", label: "Cancelled" },
];

interface LineDraft {
  productId: string;
  quantityOrdered: number;
  unitCost: number;
}

export default function PurchaseOrdersPage() {
  const { token } = useAuth();
  const { addToast } = useToast();

  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [statusFilter, setStatusFilter] = useState<PurchaseOrderStatus | "ALL">("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  async function refresh() {
    if (!token) return;
    setLoading(true);
    try {
      const [orderList, supplierList, warehouseList, productList] = await Promise.all([
        getPurchaseOrders(token, { status: statusFilter === "ALL" ? undefined : statusFilter }),
        getSuppliers(token),
        getWarehouses(token),
        getProducts(token),
      ]);
      setOrders(orderList);
      setSuppliers(supplierList);
      setWarehouses(warehouseList);
      setProducts(productList);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, statusFilter]);

  if (loading && orders.length === 0) return <p className="page-loading">Loading purchase orders…</p>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Purchase Orders</h1>
          <p className="page-subtitle">Order stock from suppliers and receive it into the ledger.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate((v) => !v)}>
          <Plus size={16} />
          {showCreate ? "Cancel" : "New Purchase Order"}
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {showCreate && (
        <CreatePOForm
          token={token!}
          suppliers={suppliers}
          warehouses={warehouses}
          products={products}
          onCreated={() => {
            setShowCreate(false);
            addToast("Purchase order created");
            refresh();
          }}
          onError={setError}
        />
      )}

      <div className="card">
        <div className="card-title-row">
          <h3 className="card-title">All Orders ({orders.length})</h3>
          <select
            className="filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as PurchaseOrderStatus | "ALL")}
          >
            {STATUS_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>

        {orders.length === 0 ? (
          <p className="empty-state">No purchase orders match this filter.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>PO #</th>
                <th>Supplier</th>
                <th>Warehouse</th>
                <th>Lines</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((po) => (
                <tr key={po.id}>
                  <td>
                    <Link to={`/purchase-orders/${po.id}`} className="table-link mono">
                      {po.poNumber}
                    </Link>
                  </td>
                  <td>{po.supplier?.name}</td>
                  <td>{po.warehouse?.name}</td>
                  <td className="mono">{po.lines.length}</td>
                  <td>
                    <span className={`status-pill status-pill--${po.status.toLowerCase()}`}>
                      {po.status}
                    </span>
                  </td>
                  <td className="mono">{new Date(po.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function CreatePOForm({
  token,
  suppliers,
  warehouses,
  products,
  onCreated,
  onError,
}: {
  token: string;
  suppliers: Supplier[];
  warehouses: Warehouse[];
  products: Product[];
  onCreated: () => void;
  onError: (msg: string) => void;
}) {
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? "");
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? "");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([
    { productId: products[0]?.id ?? "", quantityOrdered: 1, unitCost: 0 },
  ]);
  const [submitting, setSubmitting] = useState(false);

  const total = lines.reduce((sum, l) => sum + l.quantityOrdered * l.unitCost, 0);

  function updateLine(index: number, patch: Partial<LineDraft>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, { productId: products[0]?.id ?? "", quantityOrdered: 1, unitCost: 0 }]);
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!supplierId || !warehouseId || lines.length === 0) {
      onError("Choose a supplier, a warehouse, and at least one line item.");
      return;
    }
    setSubmitting(true);
    try {
      await createPurchaseOrder(token, {
        supplierId,
        warehouseId,
        notes: notes || undefined,
        lines,
      });
      onCreated();
    } catch (err) {
      onError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (suppliers.length === 0 || warehouses.length === 0 || products.length === 0) {
    return (
      <div className="alert alert-warning">
        You need at least one supplier, one warehouse, and one product before raising a purchase order.
      </div>
    );
  }

  return (
    <form className="card" onSubmit={handleSubmit}>
      <div className="po-line-row" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <label>
          Supplier
          <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} required>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Deliver to warehouse
          <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} required>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 12, fontSize: 13, fontWeight: 500 }}>
        Notes
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
      </label>

      <h4 style={{ marginTop: 20, marginBottom: 8 }}>Line items</h4>
      <div className="po-lines">
        {lines.map((line, i) => (
          <div className="po-line-row" key={i}>
            <label>
              Product
              <select
                value={line.productId}
                onChange={(e) => updateLine(i, { productId: e.target.value })}
                required
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sku})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Qty
              <input
                type="number"
                min={1}
                value={line.quantityOrdered}
                onChange={(e) => updateLine(i, { quantityOrdered: Number(e.target.value) })}
                required
              />
            </label>
            <label>
              Unit cost
              <input
                type="number"
                min={0}
                step="0.01"
                value={line.unitCost}
                onChange={(e) => updateLine(i, { unitCost: Number(e.target.value) })}
                required
              />
            </label>
            <button
              type="button"
              className="btn-danger-text"
              onClick={() => removeLine(i)}
              disabled={lines.length === 1}
              title="Remove line"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>

      <button type="button" className="btn btn-outline btn-small" onClick={addLine}>
        <Plus size={14} />
        Add line
      </button>

      <div className="po-summary-row total">
        <span>Order total</span>
        <span>{formatCurrency(total)}</span>
      </div>

      <div className="modal-actions" style={{ justifyContent: "flex-end" }}>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? "Creating..." : "Create draft order"}
        </button>
      </div>
    </form>
  );
}
