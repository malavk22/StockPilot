// client/src/pages/PurchaseOrderDetailPage.tsx

import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Send, PackageCheck, Ban } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import {
  getPurchaseOrderById,
  submitPurchaseOrder,
  receivePurchaseOrder,
  cancelPurchaseOrder,
} from "../api/purchase-order.api";
import { getErrorMessage } from "../api/error";
import { formatCurrency } from "../utils/format";
import type { PurchaseOrder } from "../types";

export default function PurchaseOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const { addToast } = useToast();

  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionPending, setActionPending] = useState(false);

  async function refresh() {
    if (!token || !id) return;
    setLoading(true);
    try {
      setPo(await getPurchaseOrderById(token, id));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, id]);

  async function runAction(action: (token: string, id: string) => Promise<PurchaseOrder>, message: string) {
    if (!token || !id) return;
    setActionPending(true);
    setError("");
    try {
      await action(token, id);
      addToast(message);
      await refresh();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActionPending(false);
    }
  }

  if (loading) return <p className="page-loading">Loading purchase order…</p>;
  if (!po) return <div className="alert alert-error">{error || "Purchase order not found"}</div>;

  const total = po.lines.reduce((sum, l) => sum + l.quantityOrdered * Number(l.unitCost), 0);

  return (
    <div>
      <Link to="/purchase-orders" className="back-link">
        <ArrowLeft size={14} /> Back to Purchase Orders
      </Link>

      <div className="page-header">
        <div>
          <h1 className="page-title mono">{po.poNumber}</h1>
          <p className="page-subtitle">
            {po.supplier?.name} &rarr; {po.warehouse?.name}
          </p>
        </div>
        <div className="row-actions">
          <span className={`status-pill status-pill--${po.status.toLowerCase()}`}>{po.status}</span>
          {po.status === "DRAFT" && (
            <>
              <button
                className="btn btn-primary"
                disabled={actionPending}
                onClick={() => runAction(submitPurchaseOrder, "Purchase order submitted")}
              >
                <Send size={16} />
                Submit
              </button>
              <button
                className="btn btn-outline"
                disabled={actionPending}
                onClick={() => runAction(cancelPurchaseOrder, "Purchase order cancelled")}
              >
                <Ban size={16} />
                Cancel
              </button>
            </>
          )}
          {po.status === "SUBMITTED" && (
            <>
              <button
                className="btn btn-primary"
                disabled={actionPending}
                onClick={() => runAction(receivePurchaseOrder, "Purchase order received — stock updated")}
              >
                <PackageCheck size={16} />
                Receive
              </button>
              <button
                className="btn btn-outline"
                disabled={actionPending}
                onClick={() => runAction(cancelPurchaseOrder, "Purchase order cancelled")}
              >
                <Ban size={16} />
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="kpi-grid">
        <div className="kpi-card">
          <div>
            <div className="kpi-value">{po.lines.length}</div>
            <div className="kpi-label">Line Items</div>
          </div>
        </div>
        <div className="kpi-card">
          <div>
            <div className="kpi-value">{formatCurrency(total)}</div>
            <div className="kpi-label">Order Total</div>
          </div>
        </div>
        <div className="kpi-card">
          <div>
            <div className="kpi-value">{new Date(po.createdAt).toLocaleDateString()}</div>
            <div className="kpi-label">Created</div>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="card-title">Line Items</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Qty Ordered</th>
              <th>Unit Cost</th>
              <th>Line Total</th>
            </tr>
          </thead>
          <tbody>
            {po.lines.map((line) => (
              <tr key={line.id}>
                <td>
                  {line.product ? (
                    <Link to={`/products/${line.product.id}`} className="table-link">
                      {line.product.name}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="mono">
                  {line.quantityOrdered} {line.product?.unit}
                </td>
                <td className="mono">{formatCurrency(line.unitCost)}</td>
                <td className="mono">{formatCurrency(line.quantityOrdered * Number(line.unitCost))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="po-summary-row total">
          <span>Total</span>
          <span>{formatCurrency(total)}</span>
        </div>
      </div>

      <div className="card">
        <h3 className="card-title">Details</h3>
        <div className="po-summary-row">
          <span>Created by</span>
          <span>{po.createdBy?.email}</span>
        </div>
        {po.submittedAt && (
          <div className="po-summary-row">
            <span>Submitted</span>
            <span>{new Date(po.submittedAt).toLocaleString()}</span>
          </div>
        )}
        {po.receivedAt && (
          <div className="po-summary-row">
            <span>Received by</span>
            <span>
              {po.receivedBy?.email} on {new Date(po.receivedAt).toLocaleString()}
            </span>
          </div>
        )}
        {po.cancelledAt && (
          <div className="po-summary-row">
            <span>Cancelled</span>
            <span>{new Date(po.cancelledAt).toLocaleString()}</span>
          </div>
        )}
        {po.notes && (
          <div className="po-summary-row">
            <span>Notes</span>
            <span>{po.notes}</span>
          </div>
        )}
      </div>
    </div>
  );
}
