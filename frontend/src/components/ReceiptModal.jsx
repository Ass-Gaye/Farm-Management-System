import { useRef } from "react";
import { formatCurrency, DEFAULT_CURRENCY } from "../services/currency";

function ReceiptModal({
  isOpen,
  sale,
  farmName = "Poultry Farm Management",
  currency = DEFAULT_CURRENCY,
  onClose,
}) {
  const receiptRef = useRef(null);

  if (!isOpen || !sale) return null;

  const handlePrint = () => {
    window.print();
  };

  const isPartiallyPaid = sale.paymentStatus === "PARTIALLY_PAID";
  const isPaid = sale.paymentStatus === "PAID";

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-content" style={{ maxWidth: 520, padding: 0 }}>
        {/* Actions bar (hidden during print) */}
        <div
          className="no-print"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "16px 24px",
            borderBottom: "1px solid var(--border-subtle)",
            background: "var(--bg-surface-muted)",
          }}
        >
          <span style={{ fontWeight: 600, fontSize: 14 }}>Official Sales Receipt</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="primary-button"
              onClick={handlePrint}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", fontSize: 13 }}
            >
              🖨️ Print Receipt
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={onClose}
              style={{ padding: "6px 12px", fontSize: 13 }}
            >
              Close
            </button>
          </div>
        </div>

        {/* Printable Receipt Body */}
        <div
          ref={receiptRef}
          id="printable-receipt"
          style={{
            padding: 32,
            background: "#ffffff",
            color: "#1f2937",
            fontFamily: "var(--font-sans, system-ui, sans-serif)",
          }}
        >
          {/* Header */}
          <div style={{ textAlign: "center", paddingBottom: 20, borderBottom: "2px dashed #e5e7eb" }}>
            <h2 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 800, color: "#111827" }}>
              {farmName}
            </h2>
            <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>
              Poultry Farm Sales & Harvest Operations • The Gambia
            </p>
            <div style={{ marginTop: 12, display: "inline-block", padding: "4px 12px", background: "#f3f4f6", borderRadius: 4, fontSize: 11, fontWeight: 600, color: "#374151" }}>
              RECEIPT #{String(sale.id).padStart(6, "0")}
            </div>
          </div>

          {/* Meta Details */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, margin: "20px 0", fontSize: 13 }}>
            <div>
              <span style={{ color: "#6b7280", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 2 }}>
                Customer / Buyer
              </span>
              <strong style={{ fontSize: 14, color: "#111827" }}>
                {sale.customer?.name || "Cash Customer"}
              </strong>
              {sale.customer?.phone && (
                <div style={{ color: "#4b5563", fontSize: 12, marginTop: 2 }}>
                  📞 {sale.customer.phone}
                </div>
              )}
            </div>

            <div style={{ textAlign: "right" }}>
              <span style={{ color: "#6b7280", fontSize: 11, textTransform: "uppercase", display: "block", marginBottom: 2 }}>
                Date Issued
              </span>
              <strong style={{ fontSize: 13, color: "#111827" }}>
                {new Date(sale.date).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </strong>
              {sale.house?.name && (
                <div style={{ color: "#4b5563", fontSize: 12, marginTop: 2 }}>
                  House: {sale.house.name}
                </div>
              )}
            </div>
          </div>

          {/* Items Table */}
          <table style={{ width: "100%", borderCollapse: "collapse", margin: "20px 0", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #d1d5db", textAlign: "left" }}>
                <th style={{ padding: "8px 0", color: "#6b7280", fontWeight: 600 }}>Description</th>
                <th style={{ padding: "8px 0", textAlign: "center", color: "#6b7280", fontWeight: 600 }}>Qty</th>
                <th style={{ padding: "8px 0", textAlign: "right", color: "#6b7280", fontWeight: 600 }}>Unit Price</th>
                <th style={{ padding: "8px 0", textAlign: "right", color: "#6b7280", fontWeight: 600 }}>Total</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: "1px solid #f3f4f6" }}>
                <td style={{ padding: "12px 0" }}>
                  <strong style={{ display: "block", color: "#111827" }}>{sale.category}</strong>
                  {sale.description && (
                    <span style={{ fontSize: 11, color: "#6b7280" }}>{sale.description}</span>
                  )}
                </td>
                <td style={{ padding: "12px 0", textAlign: "center" }}>
                  {sale.quantity ? `${sale.quantity} ${sale.unit || ""}` : "1"}
                </td>
                <td style={{ padding: "12px 0", textAlign: "right" }}>
                  {sale.unitPrice ? formatCurrency(sale.unitPrice, currency) : "—"}
                </td>
                <td style={{ padding: "12px 0", textAlign: "right", fontWeight: 700 }}>
                  {formatCurrency(sale.amount, currency)}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Financial Totals */}
          <div style={{ marginLeft: "auto", width: 220, borderTop: "1px solid #e5e7eb", paddingTop: 12, fontSize: 13 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ color: "#6b7280" }}>Subtotal:</span>
              <strong>{formatCurrency(sale.amount, currency)}</strong>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ color: "#6b7280" }}>Amount Paid:</span>
              <span style={{ color: "#059669", fontWeight: 700 }}>
                {formatCurrency(sale.amountPaid || 0, currency)}
              </span>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                paddingTop: 8,
                borderTop: "2px solid #111827",
                marginBottom: 6,
              }}
            >
              <span style={{ fontWeight: 700, color: "#111827" }}>Balance Due:</span>
              <strong
                style={{
                  fontSize: 15,
                  color: sale.amountDue > 0 ? "#dc2626" : "#059669",
                }}
              >
                {formatCurrency(sale.amountDue || 0, currency)}
              </strong>
            </div>
          </div>

          {/* Payment Status Stamp */}
          <div style={{ margin: "24px 0 12px", textAlign: "center" }}>
            <span
              style={{
                display: "inline-block",
                padding: "6px 16px",
                border: `2px solid ${isPaid ? "#059669" : isPartiallyPaid ? "#d97706" : "#dc2626"}`,
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 800,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                color: isPaid ? "#059669" : isPartiallyPaid ? "#d97706" : "#dc2626",
              }}
            >
              {sale.paymentStatus}
            </span>
          </div>

          {/* Footer */}
          <div style={{ textAlign: "center", marginTop: 20, paddingTop: 16, borderTop: "1px dashed #e5e7eb", fontSize: 11, color: "#9ca3af" }}>
            Thank you for supporting our local poultry farm!
          </div>
        </div>
      </div>
    </div>
  );
}

export default ReceiptModal;
