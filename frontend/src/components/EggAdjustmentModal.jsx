import { useState, useEffect, useContext } from "react";
import { recordEggAdjustment } from "../services/api";
import { FarmContext } from "../context/farmContextDef";

const eggPresets = [
  { label: "Broken eggs", type: "WASTAGE", direction: "SUBTRACT" },
  { label: "Spoiled / rotten eggs", type: "WASTAGE", direction: "SUBTRACT" },
  { label: "Physical count correction (-)", type: "ADJUSTMENT", direction: "SUBTRACT" },
  { label: "Physical count correction (+)", type: "ADJUSTMENT", direction: "ADD" },
  { label: "Eggs found / recount addition", type: "ADJUSTMENT", direction: "ADD" },
  { label: "Customer return (eggs back)", type: "RETURN", direction: "ADD" },
];

function EggAdjustmentModal({ isOpen, onClose, onSaved, currentStock = 0, houses = [] }) {
  const [type, setType] = useState("ADJUSTMENT");
  const [direction, setDirection] = useState("SUBTRACT");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [houseId, setHouseId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const farmContext = useContext(FarmContext);
  const notifyEggInventoryChanged = farmContext?.notifyEggInventoryChanged || null;

  useEffect(() => {
    if (isOpen) {
      setType("ADJUSTMENT");
      setDirection("SUBTRACT");
      setQuantity("");
      setReason("");
      setHouseId("");
      setDate(new Date().toISOString().split("T")[0]);
      setError("");
    }
  }, [isOpen]);

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

  const numQty = parseInt(quantity, 10) || 0;
  const signedQty = direction === "SUBTRACT" ? -Math.abs(numQty) : Math.abs(numQty);
  const previewStock = currentStock + signedQty;
  const wouldExceedStock = numQty > 0 && previewStock < 0;

  const handleTypeChange = (newType) => {
    setType(newType);
    if (newType === "WASTAGE") setDirection("SUBTRACT");
    if (newType === "RETURN") setDirection("ADD");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!numQty || numQty <= 0 || !Number.isInteger(numQty)) {
      setError("Please enter a whole number of eggs greater than 0.");
      return;
    }
    if (wouldExceedStock) {
      setError(
        `Adjustment exceeds available stock. Current stock is ${currentStock} eggs, but the reduction is ${Math.abs(signedQty)} eggs.`
      );
      return;
    }
    if (!reason.trim()) {
      setError("Please provide a reason for this adjustment.");
      return;
    }

    try {
      setLoading(true);
      await recordEggAdjustment({
        type,
        quantity: signedQty,
        reason: reason.trim(),
        date: new Date(date).toISOString(),
        houseId: houseId ? Number(houseId) : null,
      });
      if (notifyEggInventoryChanged) notifyEggInventoryChanged();
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message || "Failed to record egg adjustment.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <div>
            <h3>Egg Stock Adjustment</h3>
            <p className="modal-subtitle">
              Record breakage, spoilage, count corrections, or customer returns. No sale or income is created.
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
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="egg-adj-type">Movement Type</label>
              <select id="egg-adj-type" value={type} onChange={(e) => handleTypeChange(e.target.value)}>
                <option value="ADJUSTMENT">Count Adjustment</option>
                <option value="WASTAGE">Breakage / Spoilage</option>
                <option value="RETURN">Customer Return</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="egg-adj-direction">Direction</label>
              <select
                id="egg-adj-direction"
                value={direction}
                onChange={(e) => setDirection(e.target.value)}
                disabled={type === "WASTAGE"}
              >
                <option value="SUBTRACT">Decrease (−) stock</option>
                <option value="ADD">Increase (+) stock</option>
              </select>
              {type === "WASTAGE" && (
                <span style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                  Wastage always reduces stock.
                </span>
              )}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="egg-adj-qty">Eggs (pieces) <span style={{ color: "red" }}>*</span></label>
              <input
                id="egg-adj-qty"
                type="number"
                min="1"
                step="1"
                placeholder="e.g. 6"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="egg-adj-date">Date <span style={{ color: "red" }}>*</span></label>
              <input
                id="egg-adj-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
          </div>

          {numQty > 0 && (
            <div style={{ padding: "12px 16px", background: wouldExceedStock ? "var(--alert-danger-bg)" : "#fefce8", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ color: "var(--text-secondary)" }}>Current egg stock:</span>
                <strong>{currentStock} eggs</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 6, borderTop: "1px dashed rgba(0,0,0,0.12)" }}>
                <span style={{ fontWeight: 600 }}>New stock after adjustment:</span>
                <strong style={{ color: wouldExceedStock ? "var(--alert-danger)" : undefined }}>
                  {previewStock} eggs
                </strong>
              </div>
              {wouldExceedStock && (
                <div style={{ marginTop: 8, color: "var(--alert-danger)", fontSize: 12, fontWeight: 600 }}>
                  ⚠️ Insufficient stock! Reductions cannot exceed available eggs.
                </div>
              )}
            </div>
          )}

          {houses.length > 0 && (
            <div className="form-group">
              <label htmlFor="egg-adj-house">Related Poultry House (Optional)</label>
              <select id="egg-adj-house" value={houseId} onChange={(e) => setHouseId(e.target.value)}>
                <option value="">Whole farm</option>
                {houses.map((h) => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="egg-adj-reason">Reason / Details <span style={{ color: "red" }}>*</span></label>
            <input
              id="egg-adj-reason"
              type="text"
              placeholder="e.g. 6 broken during collection..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />
            <div style={{ marginTop: 8 }}>
              <span style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                Quick presets:
              </span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {eggPresets.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    className={`filter-btn ${reason === preset.label ? "active" : ""}`}
                    style={{ fontSize: 11, padding: "3px 8px", lineHeight: 1.2 }}
                    onClick={() => {
                      setReason(preset.label);
                      setType(preset.type);
                      setDirection(preset.direction);
                    }}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="form-actions modal-actions">
            <button type="button" className="secondary-button btn btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="primary-button btn btn-primary" disabled={loading || wouldExceedStock || !numQty}>
              {loading ? "Recording..." : "Apply Adjustment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EggAdjustmentModal;
