// client/src/pages/SuppliersPage.tsx

import { useEffect, useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { getSuppliers, createSupplier } from "../api/supplier.api";
import { getErrorMessage } from "../api/error";
import type { Supplier } from "../types";

export default function SuppliersPage() {
  const { token, user } = useAuth();
  const { addToast } = useToast();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [name, setName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isAdmin = user?.role === "ADMIN";

  async function refresh() {
    if (!token) return;
    setSuppliers(await getSuppliers(token));
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await createSupplier(token!, {
        name,
        contactEmail: contactEmail || undefined,
        contactPhone: contactPhone || undefined,
      });
      setName("");
      setContactEmail("");
      setContactPhone("");
      addToast("Supplier added");
      await refresh();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Suppliers</h1>
          <p className="page-subtitle">Vendors you order stock from.</p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {isAdmin && (
        <form className="inline-form card" onSubmit={handleSubmit}>
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label>
            Contact email
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
            />
          </label>
          <label>
            Contact phone
            <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
          </label>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            <Plus size={16} />
            {submitting ? "Adding..." : "Add supplier"}
          </button>
        </form>
      )}

      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td>{s.contactEmail ?? "—"}</td>
                <td>{s.contactPhone ?? "—"}</td>
              </tr>
            ))}
            {suppliers.length === 0 && (
              <tr>
                <td colSpan={3} className="empty-state">
                  No suppliers yet{isAdmin ? " — add one above." : "."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
