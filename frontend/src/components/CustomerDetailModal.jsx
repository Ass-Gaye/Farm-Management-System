import { useState, useEffect } from "react";
import { getCustomerById } from "../services/api";
import { formatCurrency, DEFAULT_CURRENCY } from "../services/currency";

function CustomerDetailModal({
  isOpen,
  customerId,
  currency = DEFAULT_CURRENCY,
  onClose,
  onRecordSale,
}) {
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen || !customerId) return;

    let cancelled = false;
    const fetchCustomer = async () => {
      try {
        setLoading(true);
        setError("");
        const res = await getCustomerById(customerId);
        if (!cancelled && res?.data) {
          setCustomer(res.data);
        }
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load customer profile.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchCustomer();
    return () => {
      cancelled = true;
    };
  }, [isOpen, customerId]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-content" style={{ maxWidth: 680 }}>
        <div className="modal-header">
          <div>
            <h3>Customer Financial Profile</h3>
            <p className="modal-subtitle">
              Detailed sales history, total payments, and credit balance.
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
              Loading customer statement...
            </p>
          ) : error ? (
            <div className="form-error">{error}</div>
          ) : !customer ? null : (
            <>
              {/* Customer Info Card */}
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
                    {customer.name}
                  </h4>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
                    {customer.phone && <span>📞 {customer.phone} </span>}
                    {customer.email && <span style={{ marginLeft: 8 }}>✉️ {customer.email}</span>}
                  </div>
                  {customer.address && (
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                      📍 {customer.address}
                    </div>
                  )}
                </div>

                <div style={{ textAlign: "right" }}>
                  <span
                    className={`badge ${customer.active ? "badge-healthy" : "badge-overdue"}`}
                  >
                    {customer.active ? "Active Buyer" : "Inactive"}
                  </span>
                  {customer.notes && (
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4, maxWidth: 220 }}>
                      <em>"{customer.notes}"</em>
                    </div>
                  )}
                </div>
              </div>

              {/* Financial Metrics Summary */}
              <div className="stats-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)", marginBottom: 20 }}>
                <div className="stat-card" style={{ padding: 12 }}>
                  <span className="stat-label">Total Purchases</span>
                  <strong style={{ fontSize: 18 }}>
                    {formatCurrency(customer.totalPurchases, currency)}
                  </strong>
                  <span className="stat-description">{customer.sales?.length || 0} transaction(s)</span>
                </div>

                <div className="stat-card" style={{ padding: 12 }}>
                  <span className="stat-label">Total Paid</span>
                  <strong style={{ fontSize: 18, color: "var(--alert-success)" }}>
                    {formatCurrency(customer.totalPaid, currency)}
                  </strong>
                  <span className="stat-description">Collected cash</span>
                </div>

                <div className="stat-card" style={{ padding: 12 }}>
                  <span className="stat-label">Outstanding Debt</span>
                  <strong
                    style={{
                      fontSize: 18,
                      color: customer.outstandingBalance > 0 ? "var(--alert-danger)" : "var(--alert-success)",
                    }}
                  >
                    {formatCurrency(customer.outstandingBalance, currency)}
                  </strong>
                  <span className="stat-description">
                    {customer.outstandingBalance > 0 ? "Amount owed to farm" : "Zero balance (settled)"}
                  </span>
                </div>
              </div>

              {/* Recent Purchases List */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <h4 style={{ margin: 0, fontSize: 14 }}>Recent Purchase History</h4>
                  {onRecordSale && (
                    <button
                      type="button"
                      className="primary-button"
                      onClick={() => {
                        onClose();
                        onRecordSale(customer);
                      }}
                      style={{ padding: "4px 10px", fontSize: 12 }}
                    >
                      + Record Sale for {customer.name}
                    </button>
                  )}
                </div>

                {customer.sales?.length === 0 ? (
                  <p style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: "16px 0" }}>
                    No purchase history found for this customer.
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
                        {customer.sales.map((sale) => (
                          <tr key={sale.id}>
                            <td style={{ whiteSpace: "nowrap" }}>
                              {new Date(sale.date).toLocaleDateString()}
                            </td>
                            <td>{sale.category}</td>
                            <td>
                              {sale.quantity ? `${sale.quantity} ${sale.unit || "units"}` : "—"}
                            </td>
                            <td style={{ fontWeight: 600 }}>
                              {formatCurrency(sale.amount, currency)}
                            </td>
                            <td style={{ color: "var(--alert-success)" }}>
                              {formatCurrency(sale.amountPaid, currency)}
                            </td>
                            <td style={{ color: sale.amountDue > 0 ? "var(--alert-danger)" : "inherit" }}>
                              {formatCurrency(sale.amountDue, currency)}
                            </td>
                            <td>
                              <span
                                className={`badge ${
                                  sale.paymentStatus === "PAID"
                                    ? "badge-healthy"
                                    : sale.paymentStatus === "PARTIALLY_PAID"
                                    ? "badge-due-soon"
                                    : "badge-overdue"
                                }`}
                                style={{ fontSize: 10 }}
                              >
                                {sale.paymentStatus}
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

export default CustomerDetailModal;
