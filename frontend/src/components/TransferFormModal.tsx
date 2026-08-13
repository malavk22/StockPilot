// client/src/components/TransferFormModal.tsx
//
// Shared "transfer stock between warehouses" modal — used from the
// Products list and the product detail page.

import { useState, type FormEvent } from "react";
import { transferStock } from "../api/stock.api";
import { getErrorMessage } from "../api/error";
import type { Product, Warehouse } from "../types";

export function TransferFormModal({
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
        <p className="modal-subtitle">Total stock across all warehouses: {product.currentStock}</p>

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
