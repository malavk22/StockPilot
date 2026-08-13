// client/src/pages/WarehousesPage.tsx

import { useEffect, useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { getWarehouses, createWarehouse } from "../api/warehouse.api";
import { getErrorMessage } from "../api/error";
import type { Warehouse } from "../types";

export default function WarehousesPage() {
  const { token } = useAuth();
  const { addToast } = useToast();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function refresh() {
    if (!token) return;
    setWarehouses(await getWarehouses(token));
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
      await createWarehouse(token!, { name, location: location || undefined });
      setName("");
      setLocation("");
      addToast("Warehouse added");
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
          <h1 className="page-title">Warehouses</h1>
          <p className="page-subtitle">Locations where stock is held.</p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <form className="inline-form card" onSubmit={handleSubmit}>
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label>
          Location
          <input value={location} onChange={(e) => setLocation(e.target.value)} />
        </label>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          <Plus size={16} />
          {submitting ? "Adding..." : "Add warehouse"}
        </button>
      </form>

      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Location</th>
            </tr>
          </thead>
          <tbody>
            {warehouses.map((w) => (
              <tr key={w.id}>
                <td>{w.name}</td>
                <td>{w.location ?? "—"}</td>
              </tr>
            ))}
            {warehouses.length === 0 && (
              <tr>
                <td colSpan={2} className="empty-state">
                  No warehouses yet — add one above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
