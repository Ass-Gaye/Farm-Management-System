import { useState, useEffect } from "react";
import { createDepopulationEvent, updateDepopulationEvent, getCustomers } from "../services/api";
import FullScreenFormLayout from "./common/FullScreenFormLayout";

const REASONS = [
  { value: "SOLD", label: "Sold (Commercial Sale)", color: "#16a34a" },
  { value: "SLAUGHTERED", label: "Slaughtered (Harvest / Processing)", color: "#9333ea" },
  { value: "CULLED", label: "Culled (Health / Quality Removal)", color: "#ea580c" },
  { value: "TRANSFERRED", label: "Transferred (Moved to another house/farm)", color: "#2563eb" },
  { value: "OTHER", label: "Other", color: "#64748b" },
];

function DepopulationModal({
  isOpen,
  onClose,
  onSuccess,
  event,
  flockId,
  flocks = [],
}) {
  const isEditing = Boolean(event);

  const [formData, setFormData] = useState({
    flockId: flockId ? String(flockId) : flocks?.[0]?.id ? String(flocks[0].id) : "",
    quantity: "",
    reason: "SOLD",
    date: new Date().toISOString().split("T")[0],
    notes: "",
    customerId: "",
    unitPrice: "",
    amount: "",
    amountPaid: "",
  });

  const [customers, setCustomers] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      getCustomers({ active: true })
        .then((res) => {
          if (res?.data) setCustomers(res.data);
        })
        .catch(() => {});
    }
  }, [isOpen]);

  useEffect(() => {
    if (event) {
      setFormData({
        flockId: String(event.flockId),
        quantity: String(event.quantity),
        reason: event.reason || "SOLD",
        date: event.date
          ? new Date(event.date).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0],
        notes: event.notes || "",
        customerId: event.income?.customerId ? String(event.income.customerId) : "",
        unitPrice:
          event.income?.unitPrice !== undefined && event.income?.unitPrice !== null
            ? String(event.income.unitPrice)
            : "",
        amount:
          event.income?.amount !== undefined && event.income?.amount !== null
            ? String(event.income.amount)
            : "",
        amountPaid:
          event.income?.amountPaid !== undefined && event.income?.amountPaid !== null
            ? String(event.income.amountPaid)
            : event.income?.amount !== undefined && event.income?.amount !== null
            ? String(event.income.amount)
            : "",
      });
    } else {
      setFormData({
        flockId: flockId ? String(flockId) : flocks?.[0]?.id ? String(flocks[0].id) : "",
        quantity: "",
        reason: "SOLD",
        date: new Date().toISOString().split("T")[0],
        notes: "",
        customerId: "",
        unitPrice: "",
        amount: "",
        amountPaid: "",
      });
    }
    setError("");
  }, [event, flockId, flocks, isOpen]);

  if (!isOpen) return null;

  // Find currently selected flock to calculate live birds headroom
  const selectedFlock = flocks.find((f) => String(f.id) === String(formData.flockId));
  const currentLive = selectedFlock ? Number(selectedFlock.currentBirds || 0) : 0;
  // If editing, the original event's quantity is restored to available headroom
  const maxAvailable = isEditing && event && String(event.flockId) === String(formData.flockId)
    ? currentLive + Number(event.quantity)
    : currentLive;

  const enteredQty = Number(formData.quantity) || 0;
  const liveAfter = Math.max(0, maxAvailable - enteredQty);

  const totalAmount = parseFloat(formData.amount) || 0;
  const paidAmount =
    formData.amountPaid === "" ? totalAmount : parseFloat(formData.amountPaid) || 0;
  const balanceDue = Math.max(0, Number((totalAmount - paidAmount).toFixed(2)));

  let derivedStatus = "PAID";
  if (balanceDue === 0 || paidAmount >= totalAmount) {
    derivedStatus = "PAID";
  } else if (paidAmount > 0 && paidAmount < totalAmount) {
    derivedStatus = "PARTIALLY_PAID";
  } else {
    derivedStatus = "UNPAID";
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!formData.flockId) {
      setError("Please select a flock.");
      return;
    }

    if (!enteredQty || enteredQty <= 0) {
      setError("Quantity must be a positive whole number greater than 0.");
      return;
    }

    if (enteredQty > maxAvailable) {
      setError(
        `Cannot remove ${enteredQty} birds. Only ${maxAvailable} live birds available in flock "${selectedFlock?.name}".`
      );
      return;
    }

    if (!formData.date) {
      setError("Date is required.");
      return;
    }

    if (formData.reason === "SOLD") {
      if (paidAmount < 0) {
        setError("Amount paid cannot be negative.");
        return;
      }
      if (paidAmount > totalAmount && totalAmount > 0) {
        setError("Amount paid cannot exceed total sale amount.");
        return;
      }
    }

    try {
      setSaving(true);
      const payload = {
        flockId: Number(formData.flockId),
        quantity: enteredQty,
        reason: formData.reason,
        date: new Date(formData.date).toISOString(),
        notes: formData.notes.trim() || null,
        ...(formData.reason === "SOLD"
          ? {
              unitPrice: formData.unitPrice !== "" ? parseFloat(formData.unitPrice) : null,
              amount: formData.amount !== "" ? parseFloat(formData.amount) : null,
              customerId: formData.customerId ? Number(formData.customerId) : null,
              amountPaid: formData.amountPaid !== "" ? parseFloat(formData.amountPaid) : undefined,
              paymentStatus: derivedStatus,
            }
          : {}),
      };

      if (isEditing) {
        await updateDepopulationEvent(event.id, payload);
      } else {
        await createDepopulationEvent(payload);
      }

      onSuccess();
    } catch (err) {
      setError(err.message || "Failed to save depopulation event.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="depopulation-form-overlay">
      <FullScreenFormLayout
        title={isEditing ? "Edit Depopulation Event" : "Record Depopulation / Harvest"}
        subtitle="Intentional removal of birds from a flock (sale, harvest, cull, transfer)."
        backLabel="Back to Depopulation"
        onCancel={onClose}
      >

        {/* Informational Banner */}
        <div
          style={{
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: 6,
            padding: "10px 14px",
            margin: "12px 0",
            fontSize: 12,
            color: "#475569",
            lineHeight: 1.5,
          }}
        >
          💡 <strong>Depopulation vs. Mortality:</strong> Depopulation records active bird removals. Natural bird deaths must be logged under <em>Daily Records</em>.
        </div>

        {error && <div className="form-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          {/* Flock Selector */}
          <div className="form-group">
            <label htmlFor="depop-flock-select">
              Select Flock / Batch <span style={{ color: "red" }}>*</span>
            </label>
            <select
              id="depop-flock-select"
              value={formData.flockId}
              onChange={(e) => setFormData({ ...formData, flockId: e.target.value })}
              disabled={isEditing || flocks.length <= 1}
              required
            >
              {flocks.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} ({f.purpose}) — {f.currentBirds} Live Birds Available
                </option>
              ))}
            </select>
            {selectedFlock && (
              <div
                style={{
                  display: "flex",
                  gap: 14,
                  marginTop: 6,
                  padding: "6px 10px",
                  background: "var(--bg-muted)",
                  borderRadius: 4,
                  fontSize: 12,
                }}
              >
                <span>Placed: <strong>{selectedFlock.birdsPlaced}</strong></span>
                <span>Mortality: <strong>{selectedFlock.totalMortality}</strong></span>
                <span>Available Live: <strong style={{ color: "var(--color-primary)" }}>{maxAvailable}</strong></span>
              </div>
            )}
          </div>

          {/* Reason Selection */}
          <div className="form-group">
            <label htmlFor="depop-reason">
              Removal Reason <span style={{ color: "red" }}>*</span>
            </label>
            <select
              id="depop-reason"
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              required
            >
              {REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {/* Quantity & Date Grid */}
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="depop-quantity">
                Quantity (Birds) <span style={{ color: "red" }}>*</span>
              </label>
              <input
                id="depop-quantity"
                type="number"
                min="1"
                max={maxAvailable > 0 ? maxAvailable : 1}
                placeholder="e.g. 100"
                value={formData.quantity}
                onChange={(e) => {
                  const newQty = e.target.value;
                  const q = Number(newQty) || 0;
                  const p = parseFloat(formData.unitPrice);
                  const next = { ...formData, quantity: newQty };
                  if (!isNaN(p) && p >= 0 && q > 0) {
                    const calcTotal = Number((q * p).toFixed(2));
                    next.amount = String(calcTotal);
                    if (!formData.amountPaid || formData.amountPaid === formData.amount) {
                      next.amountPaid = String(calcTotal);
                    }
                  }
                  setFormData(next);
                }}
                required
              />
              {maxAvailable > 0 && enteredQty > 0 && (
                <small
                  style={{
                    display: "block",
                    marginTop: 4,
                    fontSize: 11,
                    color: enteredQty > maxAvailable ? "var(--alert-danger)" : "var(--text-muted)",
                  }}
                >
                  Live birds after: <strong>{liveAfter}</strong>
                </small>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="depop-date">
                Date <span style={{ color: "red" }}>*</span>
              </label>
              <input
                id="depop-date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
              />
            </div>
          </div>

          {/* Bird Sale Financial Integration Section */}
          {formData.reason === "SOLD" && (
            <div
              style={{
                background: "var(--bg-surface-muted, #f8fafc)",
                padding: 14,
                borderRadius: 6,
                marginBottom: 16,
                border: "1px solid var(--border-subtle, #e2e8f0)",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--text-secondary, #475569)",
                  marginBottom: 10,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span>💰</span> Bird Sale Financial Details (Automatic Income Sync)
              </div>

              {/* Customer Selector */}
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label htmlFor="depop-customer" style={{ fontSize: 12 }}>
                  Customer / Buyer (Optional)
                </label>
                <select
                  id="depop-customer"
                  value={formData.customerId}
                  onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                >
                  <option value="">Cash / Walk-in Buyer (No customer profile)</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.phone ? `(${c.phone})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Unit Price & Total Sale Grid */}
              <div className="form-row" style={{ marginBottom: 12 }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label htmlFor="depop-unit-price" style={{ fontSize: 12 }}>
                    Price per Bird (GMD)
                  </label>
                  <input
                    id="depop-unit-price"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="e.g. 350"
                    value={formData.unitPrice}
                    onChange={(e) => {
                      const newPrice = e.target.value;
                      const p = parseFloat(newPrice);
                      const q = enteredQty;
                      const next = { ...formData, unitPrice: newPrice };
                      if (!isNaN(p) && p >= 0 && q > 0) {
                        const calcTotal = Number((q * p).toFixed(2));
                        next.amount = String(calcTotal);
                        if (!formData.amountPaid || formData.amountPaid === formData.amount) {
                          next.amountPaid = String(calcTotal);
                        }
                      }
                      setFormData(next);
                    }}
                  />
                </div>

                <div className="form-group" style={{ flex: 1 }}>
                  <label htmlFor="depop-amount" style={{ fontSize: 12 }}>
                    Total Sale Value (GMD)
                  </label>
                  <input
                    id="depop-amount"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={formData.amount}
                    onChange={(e) => {
                      const newAmount = e.target.value;
                      const next = { ...formData, amount: newAmount };
                      if (!formData.amountPaid || formData.amountPaid === formData.amount) {
                        next.amountPaid = newAmount;
                      }
                      setFormData(next);
                    }}
                  />
                </div>
              </div>

              {/* Amount Paid & Payment Status */}
              <div className="form-row">
                <div className="form-group" style={{ flex: 1 }}>
                  <label htmlFor="depop-amount-paid" style={{ fontSize: 12 }}>
                    Amount Received (GMD)
                  </label>
                  <input
                    id="depop-amount-paid"
                    type="number"
                    step="0.01"
                    min="0"
                    max={totalAmount > 0 ? totalAmount : undefined}
                    placeholder={formData.amount || "0.00"}
                    value={formData.amountPaid}
                    onChange={(e) => setFormData({ ...formData, amountPaid: e.target.value })}
                  />
                </div>

                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    padding: "8px 12px",
                    borderRadius: 4,
                    background:
                      derivedStatus === "PAID"
                        ? "#f0fdf4"
                        : derivedStatus === "PARTIALLY_PAID"
                        ? "#fffbeb"
                        : "#fef2f2",
                    border: `1px solid ${
                      derivedStatus === "PAID"
                        ? "#bbf7d0"
                        : derivedStatus === "PARTIALLY_PAID"
                        ? "#fde68a"
                        : "#fecaca"
                    }`,
                    fontSize: 12,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                    <span>Balance Due:</span>
                    <strong style={{ color: balanceDue > 0 ? "#dc2626" : "#16a34a" }}>
                      {balanceDue.toFixed(2)} GMD
                    </strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>Status:</span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "2px 6px",
                        borderRadius: 3,
                        background:
                          derivedStatus === "PAID"
                            ? "#dcfce7"
                            : derivedStatus === "PARTIALLY_PAID"
                            ? "#fef3c7"
                            : "#fee2e2",
                        color:
                          derivedStatus === "PAID"
                            ? "#15803d"
                            : derivedStatus === "PARTIALLY_PAID"
                            ? "#b45309"
                            : "#b91c1c",
                      }}
                    >
                      {derivedStatus}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="form-group">
            <label htmlFor="depop-notes">Notes / Details (Optional)</label>
            <textarea
              id="depop-notes"
              rows="3"
              placeholder="e.g. Sold to Central Market at 250 GMD each, or culled due to respiratory signs."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>

          <div className="form-actions">
            <button type="button" className="secondary-button" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="primary-button" disabled={saving || maxAvailable === 0}>
              {saving ? "Saving..." : isEditing ? "Update Event" : "Record Depopulation"}
            </button>
          </div>
        </form>
      </FullScreenFormLayout>
    </div>
  );
}

export default DepopulationModal;
