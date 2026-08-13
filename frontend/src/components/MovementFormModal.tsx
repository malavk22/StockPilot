// client/src/components/MovementFormModal.tsx
//
// Shared "record a stock movement" modal — used from the Products list
// (target product fixed) and the product detail page.

import { useState, type FormEvent } from "react";
import { recordMovement } from "../api/stock.api";
import { getErrorMessage } from "../api/error";
import type { MovementType, Product, Warehouse } from "../types";

export function MovementFormModal({
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
        <p className="modal-subtitle">Current stock: {product.currentStock}</p>

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
