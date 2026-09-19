import { useState, useEffect } from "react";
import { getSupplierById } from "../services/api";
import { formatCurrency, DEFAULT_CURRENCY } from "../services/currency";

function SupplierDetailModal({
  isOpen,
  supplierId,
  currency = DEFAULT_CURRENCY,
  onClose,
  onRecordExpense,
}) {
  const [supplier, setSupplier] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen || !supplierId) return;

    let cancelled = false;
    const fetchSupplier = async () => {
      try {
        setLoading(true);
        setError("");
        const res = await getSupplierById(supplierId);
        if (!cancelled && res?.data) {
          setSupplier(res.data);
        }
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load supplier profile.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchSupplier();
    return () => {
      cancelled = true;
    };
  }, [isOpen, supplierId]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-content" style={{ maxWidth: 680 }}>
        <div className="modal-header">
          <div>
            <h3>Supplier Financial Profile</h3>
            <p className="modal-subtitle">
              Feed and supply purchase history, total payments, and payables owed.
            </p>
          </div>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div style={{ padding: "0 24px 24px" }}>
          {loading ? (
            <p style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
              Loading supplier statement...
            </p>
          ) : error ? (
            <div className="form-error">{error}</div>
          ) : !supplier ? null : (
            <>
              {/* Supplier Info Card */}
              <div
                style={{
                  background: "var(--bg-surface-muted)",
                  padding: 16,
                  borderRadius: "var(--radius-md)",
                  marginBottom: 20,
                  display: "flex",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 12,
                }}
              >
                <div>
                  <h4 style={{ margin: 0, fontSize: 18, color: "var(--text-primary)" }}>
                    {supplier.name}
                  </h4>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
                    {supplier.category && <span className="badge badge-upcoming" style={{ marginRight: 8 }}>{supplier.category}</span>}
                    {supplier.phone && <span>📞 {supplier.phone} </span>}
                    {supplier.email && <span style={{ marginLeft: 8 }}>✉️ {supplier.email}</span>}
                  </div>
                  {supplier.address && (
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                      📍 {supplier.address}
                    </div>
                  )}
                </div>

                <div style={{ textAlign: "right" }}>
                  <span
                    className={`badge ${supplier.active ? "badge-healthy" : "badge-overdue"}`}
                  >
                    {supplier.active ? "Active Partner" : "Inactive"}
                  </span>
                  {supplier.notes && (
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4, maxWidth: 220 }}>
                      <em>"{supplier.notes}"</em>
                    </div>
                  )}
                </div>
              </div>

              {/* Financial Metrics Summary */}
              <div className="stats-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)", marginBottom: 20 }}>
                <div className="stat-card" style={{ padding: 12 }}>
                  <span className="stat-label">Total Purchased</span>
                  <strong style={{ fontSize: 18 }}>
                    {formatCurrency(supplier.totalPurchases, currency)}
                  </strong>
                  <span className="stat-description">{supplier.expenses?.length || 0} order(s)</span>
                </div>

                <div className="stat-card" style={{ padding: 12 }}>
                  <span className="stat-label">Total Paid Out</span>
                  <strong style={{ fontSize: 18, color: "var(--alert-success)" }}>
                    {formatCurrency(supplier.totalPaid, currency)}
                  </strong>
                  <span className="stat-description">Disbursed cash</span>
                </div>

                <div className="stat-card" style={{ padding: 12 }}>
                  <span className="stat-label">Payables Owed</span>
                  <strong
                    style={{
                      fontSize: 18,
                      color: supplier.outstandingPayables > 0 ? "var(--alert-danger)" : "var(--alert-success)",
                    }}
                  >
                    {formatCurrency(supplier.outstandingPayables, currency)}
                  </strong>
                  <span className="stat-description">
                    {supplier.outstandingPayables > 0 ? "Amount owed to supplier" : "Zero balance (settled)"}
                  </span>
                </div>
              </div>

              {/* Recent Orders / Expenses List */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <h4 style={{ margin: 0, fontSize: 14 }}>Supply Orders & Purchases</h4>
                  {onRecordExpense && (
                    <button
                      type="button"
                      className="primary-button"
                      onClick={() => {
                        onClose();
                        onRecordExpense(supplier);
                      }}
                      style={{ padding: "4px 10px", fontSize: 12 }}
                    >
                      + Record Purchase from {supplier.name}
                    </button>
                  )}
                </div>

                {supplier.expenses?.length === 0 ? (
                  <p style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: "16px 0" }}>
                    No purchase history found for this supplier.
                  </p>
                ) : (
                  <div className="table-wrapper" style={{ maxHeight: 240, overflowY: "auto" }}>
                    <table className="data-table" style={{ width: "100%", fontSize: 12 }}>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Category</th>
                          <th>Qty / Unit</th>
                          <th>Total</th>
                          <th>Paid</th>
                          <th>Balance</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {supplier.expenses.map((exp) => (
                          <tr key={exp.id}>
                            <td style={{ whiteSpace: "nowrap" }}>
                              {new Date(exp.date).toLocaleDateString()}
                            </td>
                            <td>{exp.category}</td>
                            <td>
                              {exp.quantity ? `${exp.quantity} ${exp.unit || "units"}` : "—"}
                            </td>
                            <td style={{ fontWeight: 600 }}>
                              {formatCurrency(exp.amount, currency)}
                            </td>
                            <td style={{ color: "var(--alert-success)" }}>
                              {formatCurrency(exp.amountPaid, currency)}
                            </td>
                            <td style={{ color: exp.amountDue > 0 ? "var(--alert-danger)" : "inherit" }}>
                              {formatCurrency(exp.amountDue, currency)}
                            </td>
                            <td>
                              <span
                                className={`badge ${
                                  exp.paymentStatus === "PAID"
                                    ? "badge-healthy"
                                    : exp.paymentStatus === "PARTIALLY_PAID"
                                    ? "badge-due-soon"
                                    : "badge-overdue"
                                }`}
                                style={{ fontSize: 10 }}
                              >
                                {exp.paymentStatus}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="form-actions" style={{ marginTop: 20 }}>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={onClose}
                >
                  Close
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default SupplierDetailModal;
