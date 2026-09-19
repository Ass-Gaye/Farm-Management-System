import { useState, useEffect } from "react";
import { updateIncome, updateExpense } from "../services/api";
import { formatCurrency, DEFAULT_CURRENCY } from "../services/currency";

function PaymentModal({
  isOpen,
  target = null, // { type: "Income" | "Expense", item: { ... } }
  currency = DEFAULT_CURRENCY,
  onSuccess,
  onCancel,
}) {
  const item = target?.item;
  const isIncome = target?.type === "Income";

  const totalAmount = Number(item?.amount || 0);
  const alreadyPaid = Number(item?.amountPaid || 0);
  const balanceDue = Number(item?.amountDue || Math.max(0, totalAmount - alreadyPaid));

  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen && item) {
      setPaymentAmount(String(balanceDue));
      setPaymentDate(new Date().toISOString().split("T")[0]);
      setNote("");
      setError("");
    }
  }, [isOpen, item, balanceDue]);

  if (!isOpen || !item) return null;

  const parsedAmount = parseFloat(paymentAmount) || 0;
  const remainingAfterPayment = Math.max(0, Number((balanceDue - parsedAmount).toFixed(2)));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Please enter a valid payment amount greater than 0.");
      return;
    }

    if (parsedAmount > balanceDue) {
      setError(`Payment amount cannot exceed the balance due of ${formatCurrency(balanceDue, currency)}.`);
      return;
    }

    const newAmountPaid = Number((alreadyPaid + parsedAmount).toFixed(2));
    const appendNote = note.trim()
      ? `${item.description ? `${item.description} | ` : ""}Payment of ${formatCurrency(parsedAmount, currency)} on ${paymentDate}${note ? ` (${note.trim()})` : ""}`
      : item.description;

    try {
      setSaving(true);
      let updated;
      if (isIncome) {
        updated = await updateIncome(item.id, {
          amountPaid: newAmountPaid,
          description: appendNote,
        });
      } else {
        updated = await updateExpense(item.id, {
          amountPaid: newAmountPaid,
          description: appendNote,
        });
      }

      onSuccess(updated.data, parsedAmount, target.type);
    } catch (err) {
      setError(err.message || "Failed to record payment.");
    } finally {
      setSaving(false);
    }
  };

  const counterpartyName = isIncome
    ? item.customer?.name || "Customer"
    : item.supplier?.name || "Supplier";

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-content" style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <div>
            <h3>{isIncome ? "Receive Customer Payment" : "Settle Supplier Payable"}</h3>
            <p className="modal-subtitle">
              {isIncome
                ? `Record a full or partial debt collection from ${counterpartyName}.`
                : `Record a cash or bank payment to ${counterpartyName}.`}
            </p>
          </div>
          <button
            type="button"
            className="modal-close"
            onClick={onCancel}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: "0 24px 24px" }}>
          {error && <div className="form-error" style={{ marginBottom: 16 }}>{error}</div>}

          {/* Transaction Summary Card */}
          <div
            style={{
              background: "var(--bg-surface-muted)",
              padding: 14,
              borderRadius: "var(--radius-md)",
              marginBottom: 16,
              border: "1px solid var(--border-subtle)",
              fontSize: 13,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ color: "var(--text-muted)" }}>Counterparty:</span>
              <strong>{counterpartyName}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ color: "var(--text-muted)" }}>Item / Category:</span>
              <span>{item.category} {item.quantity ? `(${item.quantity} ${item.unit || ""})` : ""}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ color: "var(--text-muted)" }}>Total Invoiced:</span>
              <span>{formatCurrency(totalAmount, currency)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ color: "var(--text-muted)" }}>Already Paid:</span>
              <span style={{ color: "var(--alert-success)" }}>{formatCurrency(alreadyPaid, currency)}</span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                paddingTop: 8,
                borderTop: "1px dashed var(--border-default)",
                fontSize: 14,
              }}
            >
              <strong>Remaining Balance Due:</strong>
              <strong style={{ color: "var(--alert-danger)" }}>
                {formatCurrency(balanceDue, currency)}
              </strong>
            </div>
          </div>

          {/* Payment Amount */}
          <div className="form-group">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <label htmlFor="payment-amount" style={{ margin: 0 }}>
                Payment Amount ({currency}) <span style={{ color: "var(--alert-danger)" }}>*</span>
              </label>
              <button
                type="button"
                onClick={() => setPaymentAmount(String(balanceDue))}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: 11,
                  color: "var(--pine-700)",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Pay Full ({formatCurrency(balanceDue, currency)})
              </button>
            </div>
            <input
              id="payment-amount"
              type="number"
              step="any"
              min="0.01"
              max={balanceDue}
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              required
              autoFocus
              placeholder="Enter amount..."
              style={{ fontSize: 16, fontWeight: 700 }}
            />
          </div>

          {/* Payment Date */}
          <div className="form-group">
            <label htmlFor="payment-date">Payment Date</label>
            <input
              id="payment-date"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              required
            />
          </div>

          {/* Note / Method */}
          <div className="form-group">
            <label htmlFor="payment-note">Payment Method / Note (Optional)</label>
            <input
              id="payment-note"
              type="text"
              placeholder="e.g. Cash, Wave mobile money, Bank transfer #102..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          {/* Balance Preview */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "10px 14px",
              borderRadius: "var(--radius-sm)",
              background: remainingAfterPayment === 0 ? "#f0fdf4" : "#fffbeb",
              border: `1px solid ${remainingAfterPayment === 0 ? "#bbf7d0" : "#fde68a"}`,
              fontSize: 12,
              marginBottom: 20,
            }}
          >
            <span>Remaining after this payment:</span>
            <strong style={{ color: remainingAfterPayment === 0 ? "var(--alert-success)" : "var(--alert-danger)" }}>
              {formatCurrency(remainingAfterPayment, currency)} {remainingAfterPayment === 0 ? "✓ Settle in Full" : "(Partial)"}
            </strong>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={onCancel}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="primary-button"
              disabled={saving}
            >
              {saving ? "Recording..." : isIncome ? "Confirm Receipt of Payment" : "Confirm Payment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default PaymentModal;
