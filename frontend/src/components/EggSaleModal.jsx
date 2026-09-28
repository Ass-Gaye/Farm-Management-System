import { useState, useEffect, useContext } from "react";
import { createEggSale, updateEggSale, getCustomers } from "../services/api";
import { FarmContext } from "../context/farmContextDef";

function EggSaleModal({
  isOpen,
  onClose,
  onSaved,
  sale = null,
  houses = [],
  flocks = [],
  customers = [],
  currentStock = 0,
}) {
  const isEditing = Boolean(sale);
  const farmContext = useContext(FarmContext);
  const notifyEggInventoryChanged = farmContext?.notifyEggInventoryChanged || null;

  const [formData, setFormData] = useState({
    houseId: "",
    flockId: "",
    customerId: "",
    quantity: "",
    unitPrice: "",
    amount: "",
    amountPaid: "",
    date: new Date().toISOString().split("T")[0],
    notes: "",
  });
  const [localCustomers, setLocalCustomers] = useState(customers);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen && customers.length === 0) {
      getCustomers({ active: true })
        .then((res) => {
          if (res?.data) setLocalCustomers(res.data);
        })
        .catch(() => {});
    } else {
      setLocalCustomers(customers);
    }
  }, [isOpen, customers]);

  useEffect(() => {
    if (!isOpen) return;
    if (sale) {
      setFormData({
        houseId: sale.houseId ? String(sale.houseId) : "",
        flockId: sale.flockId ? String(sale.flockId) : "",
        customerId: sale.income?.customerId
          ? String(sale.income.customerId)
          : sale.customerId
            ? String(sale.customerId)
            : "",
        quantity: String(sale.quantity ?? ""),
        unitPrice: (() => {
          const p = sale.income?.unitPrice ?? sale.unitPrice;
          return p === undefined || p === null ? "" : String(p);
        })(),
        amount:
          sale.income?.amount !== undefined && sale.income?.amount !== null
            ? String(sale.income.amount)
            : "",
        amountPaid:
          sale.income?.amountPaid !== undefined && sale.income?.amountPaid !== null
            ? String(sale.income.amountPaid)
            : "",
        date: sale.date
          ? new Date(sale.date).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0],
        notes: sale.notes || "",
      });
    } else {
      setFormData({
        houseId: houses?.[0]?.id ? String(houses[0].id) : "",
        flockId: "",
        customerId: "",
        quantity: "",
        unitPrice: "",
        amount: "",
        amountPaid: "",
        date: new Date().toISOString().split("T")[0],
        notes: "",
      });
    }
    setError("");
  }, [isOpen, sale, houses]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const enteredQty = parseInt(formData.quantity, 10) || 0;
  const maxAvailable = isEditing && sale ? currentStock + Number(sale.quantity) : currentStock;

  const totalAmount = parseFloat(formData.amount) || 0;
  const paidAmount =
    formData.amountPaid === "" ? totalAmount : parseFloat(formData.amountPaid) || 0;
  const balanceDue = Math.max(0, Number((totalAmount - paidAmount).toFixed(2)));

  let derivedStatus = "PAID";
  if (paidAmount > 0 && paidAmount < totalAmount) derivedStatus = "PARTIALLY_PAID";
  else if (paidAmount <= 0 && totalAmount > 0) derivedStatus = "UNPAID";

  const setQty = (newQty) => {
    const q = parseInt(newQty, 10) || 0;
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
  };

  const setPrice = (newPrice) => {
    const p = parseFloat(newPrice);
    const next = { ...formData, unitPrice: newPrice };
    if (!isNaN(p) && p >= 0 && enteredQty > 0) {
      const calcTotal = Number((enteredQty * p).toFixed(2));
      next.amount = String(calcTotal);
      if (!formData.amountPaid || formData.amountPaid === formData.amount) {
        next.amountPaid = String(calcTotal);
      }
    }
    setFormData(next);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!enteredQty || enteredQty <= 0 || !Number.isInteger(enteredQty)) {
      setError("Quantity must be a whole number of eggs greater than 0.");
      return;
    }
    if (enteredQty > maxAvailable) {
      setError(
        `Not enough eggs in stock. Available: ${maxAvailable} eggs, requested: ${enteredQty} eggs.`
      );
      return;
    }
    if (!formData.date) {
      setError("Date is required.");
      return;
    }
    if (paidAmount < 0) {
      setError("Amount paid cannot be negative.");
      return;
    }
    if (paidAmount > totalAmount && totalAmount > 0) {
      setError("Amount paid cannot exceed the total sale amount.");
      return;
    }

    try {
      setSaving(true);
      const payload = {
        houseId: formData.houseId ? Number(formData.houseId) : null,
        flockId: formData.flockId ? Number(formData.flockId) : null,
        customerId: formData.customerId ? Number(formData.customerId) : null,
        quantity: enteredQty,
        unitPrice: formData.unitPrice !== "" ? parseFloat(formData.unitPrice) : null,
        amount: formData.amount !== "" ? parseFloat(formData.amount) : null,
        amountPaid: formData.amountPaid !== "" ? parseFloat(formData.amountPaid) : undefined,
        paymentStatus: derivedStatus,
        date: new Date(formData.date).toISOString(),
        notes: formData.notes.trim() || null,
      };

      if (isEditing) {
        await updateEggSale(sale.id, payload);
      } else {
        await createEggSale(payload);
      }

      if (notifyEggInventoryChanged) notifyEggInventoryChanged();
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message || "Failed to save egg sale.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 580 }}>
        <div className="modal-header">
          <div>
            <h3>{isEditing ? "Edit Egg Sale" : "Record Egg Sale"}</h3>
            <p className="modal-subtitle">
              Sell eggs by the piece. Stock, payment and finance update together.
            </p>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close modal">
            &times;
          </button>
        </div>

        {error && (
          <div className="alert-banner alert-error" style={{ margin: "0 24px 16px" }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ padding: "0 24px 24px" }}>
          <div style={{ padding: "10px 14px", borderRadius: 6, marginBottom: 14, fontSize: 12, background: "#fefce8", border: "1px solid #fde68a", color: "#92400e" }}>
            🥚 <strong> Eggs in stock: {Number(currentStock).toLocaleString()}</strong>
            {enteredQty > 0 && (
              <span> · After sale: <strong>{Math.max(0, maxAvailable - enteredQty).toLocaleString()}</strong></span>
            )}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="egg-house">Poultry House (Optional)</label>
              <select
                id="egg-house"
                value={formData.houseId}
                onChange={(e) => setFormData({ ...formData, houseId: e.target.value })}
              >
                <option value="">Whole farm</option>
                {houses.map((h) => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="egg-flock">Flock (Optional)</label>
              <select
                id="egg-flock"
                value={formData.flockId}
                onChange={(e) => setFormData({ ...formData, flockId: e.target.value })}
              >
                <option value="">All flocks</option>
                {flocks.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="egg-customer">Customer / Buyer (Optional)</label>
            <select
              id="egg-customer"
              value={formData.customerId}
              onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
            >
              <option value="">Cash / Walk-in buyer</option>
              {localCustomers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.phone ? `(${c.phone})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="egg-qty">Eggs Sold (pieces) <span style={{ color: "red" }}>*</span></label>
              <input
                id="egg-qty"
                type="number"
                min="1"
                step="1"
                placeholder="e.g. 60"
                value={formData.quantity}
                onChange={(e) => setQty(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="egg-date">Date <span style={{ color: "red" }}>*</span></label>
              <input
                id="egg-date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="egg-price">Price per Egg (GMD)</label>
              <input
                id="egg-price"
                type="number"
                step="0.01"
                min="0"
                placeholder="e.g. 15"
                value={formData.unitPrice}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="egg-amount">Total Sale Value (GMD)</label>
              <input
                id="egg-amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={formData.amount}
                onChange={(e) => {
                  const next = { ...formData, amount: e.target.value };
                  if (!formData.amountPaid || formData.amountPaid === formData.amount) {
                    next.amountPaid = e.target.value;
                  }
                  setFormData(next);
                }}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="egg-paid">Amount Received (GMD)</label>
              <input
                id="egg-paid"
                type="number"
                step="0.01"
                min="0"
                placeholder={formData.amount || "0.00"}
                value={formData.amountPaid}
                onChange={(e) => setFormData({ ...formData, amountPaid: e.target.value })}
              />
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "8px 12px", borderRadius: 4, background: derivedStatus === "PAID" ? "#f0fdf4" : derivedStatus === "PARTIALLY_PAID" ? "#fffbeb" : "#fef2f2", border: "1px solid #e2e8f0", fontSize: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                <span>Balance due:</span>
                <strong style={{ color: balanceDue > 0 ? "#dc2626" : "#16a34a" }}>{balanceDue.toFixed(2)} GMD</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Status:</span>
                <strong>{derivedStatus}</strong>
              </div>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="egg-notes">Notes (Optional)</label>
            <textarea
              id="egg-notes"
              rows="2"
              placeholder="e.g. Morning collection sold to market vendor."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>

          <div className="form-actions modal-actions">
            <button type="button" className="secondary-button btn btn-secondary" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="primary-button btn btn-primary" disabled={saving}>
              {saving ? "Saving..." : isEditing ? "Update Sale" : "Record Sale"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EggSaleModal;
