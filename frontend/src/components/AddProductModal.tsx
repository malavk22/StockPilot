// client/src/components/AddProductModal.tsx
//
// Shared "add a product" modal — used from the Products page and the
// Dashboard's quick action.

import { useState, type FormEvent } from "react";
import { createProduct } from "../api/product.api";
import { getErrorMessage } from "../api/error";

export function AddProductModal({
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
