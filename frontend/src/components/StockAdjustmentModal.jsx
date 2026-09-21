import { useState, useEffect } from "react";
import { recordStockAdjustment } from "../services/api";

const commonPresets = [
  { label: "Damaged feed (moisture / water)", type: "WASTAGE", direction: "SUBTRACT" },
  { label: "Spillage / rodents / pest damage", type: "WASTAGE", direction: "SUBTRACT" },
  { label: "Expired / spoiled batch", type: "WASTAGE", direction: "SUBTRACT" },
  { label: "Physical count reconciliation (-)", type: "ADJUSTMENT", direction: "SUBTRACT" },
  { label: "Physical count reconciliation (+)", type: "ADJUSTMENT", direction: "ADD" },
  { label: "Defective batch returned to supplier", type: "RETURN", direction: "SUBTRACT" },
];

function StockAdjustmentModal({
  isOpen,
  onClose,
  onSaved,
  feedTypes = [],
  selectedFeedId = null,
  houses = [],
}) {
  const [feedTypeId, setFeedTypeId] = useState("");
  const [selectedUnit, setSelectedUnit] = useState("kg");
  const [type, setType] = useState("ADJUSTMENT");
  const [direction, setDirection] = useState("SUBTRACT"); // "SUBTRACT" | "ADD"
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [houseId, setHouseId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Sync state whenever modal is opened or target feed changes
  useEffect(() => {
    if (isOpen) {
      let initialId = "";
      if (selectedFeedId && feedTypes.some((f) => String(f.id) === String(selectedFeedId))) {
        initialId = String(selectedFeedId);
      } else if (feedTypes.length > 0) {
        initialId = String(feedTypes[0].id);
      }

      setFeedTypeId(initialId);

      const selFeed = feedTypes.find((f) => String(f.id) === String(initialId));
      setSelectedUnit(selFeed?.unit || "kg");
      setType("ADJUSTMENT");
      setDirection("SUBTRACT");
      setQuantity("");
      setReason("");
      setHouseId("");
      setDate(new Date().toISOString().split("T")[0]);
      setError("");
    }
  }, [isOpen, selectedFeedId, feedTypes]);

  // Keyboard accessibility (Escape key to dismiss) and prevent background scrolling
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
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

  const currentFeed = feedTypes.find((f) => String(f.id) === String(feedTypeId));
  const feedUnit = currentFeed?.unit || "kg";
  const currentStock = currentFeed ? Number(currentFeed.currentStock) : 0;
  const hasBagConversion = Boolean(currentFeed?.bagWeightKg && Number(currentFeed.bagWeightKg) > 0);
  const bagWeight = hasBagConversion ? Number(currentFeed.bagWeightKg) : 50;

  const handleFeedChange = (newFeedId) => {
    setFeedTypeId(newFeedId);
    const selFeed = feedTypes.find((f) => String(f.id) === String(newFeedId));
    if (selFeed) {
      setSelectedUnit(selFeed.unit || "kg");
    }
    setError("");
  };

  const handleTypeChange = (newType) => {
    setType(newType);
    if (newType === "WASTAGE" || newType === "RETURN") {
      setDirection("SUBTRACT");
    }
  };

  const handleApplyPreset = (preset) => {
    setReason(preset.label);
    setType(preset.type);
    setDirection(preset.direction);
  };

  // Compute quantity and stock preview
  const numQty = parseFloat(quantity) || 0;
  const signedQty = direction === "SUBTRACT" ? -Math.abs(numQty) : Math.abs(numQty);

  let effectiveQtyInFeedUnit = signedQty;
  if (hasBagConversion) {
    if (selectedUnit === "bags" && feedUnit === "kg") {
      effectiveQtyInFeedUnit = signedQty * bagWeight;
    } else if (selectedUnit === "kg" && feedUnit === "bags") {
      effectiveQtyInFeedUnit = signedQty / bagWeight;
    }
  }

  const roundedEffectiveQty = Math.round(effectiveQtyInFeedUnit * 1000) / 1000;
  const previewStock = Math.round((currentStock + effectiveQtyInFeedUnit) * 1000) / 1000;
  const wouldExceedStock = numQty > 0 && previewStock < 0;
  const isBelowMinStock =
    numQty > 0 &&
    previewStock >= 0 &&
    currentFeed?.minimumStock !== undefined &&
    previewStock <= Number(currentFeed.minimumStock);
  const hasUnitConversion = selectedUnit !== feedUnit && hasBagConversion;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!feedTypeId) {
      setError("Please select a feed type to adjust.");
      return;
    }

    if (numQty <= 0 || isNaN(numQty)) {
      setError("Please enter a valid quantity greater than 0.");
      return;
    }

    if (wouldExceedStock) {
      setError(
        `Adjustment exceeds available stock. Current stock is ${currentStock} ${feedUnit}, but requested reduction is ${Math.abs(
          roundedEffectiveQty
        )} ${feedUnit}.`
      );
      return;
    }

    if (!reason.trim()) {
      setError("Please provide a reason or note for this stock adjustment.");
      return;
    }

    try {
      setLoading(true);

      await recordStockAdjustment({
        feedTypeId: Number(feedTypeId),
        type,
        quantity: signedQty,
        unit: selectedUnit,
        reason: reason.trim(),
        date: new Date(date).toISOString(),
        houseId: houseId ? Number(houseId) : null,
      });

      onSaved();
      onClose();
    } catch (err) {
      setError(err.message || "Failed to record stock adjustment");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 580 }}
      >
        <div className="modal-header">
          <div>
            <h3>Stock Adjustment / Wastage</h3>
            <p className="modal-subtitle">
              Record physical stock corrections, damage, spoilage, or returns to supplier.
            </p>
          </div>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Close modal"
          >
            &times;
          </button>
        </div>

        {error && (
          <div className="alert-banner alert-error" style={{ margin: "0 24px 16px" }}>
            {error}
          </div>
        )}

        {feedTypes.length === 0 ? (
          <div style={{ padding: "24px", textAlign: "center" }}>
            <p className="text-muted" style={{ marginBottom: "16px" }}>
              No feed varieties have been configured yet. Please add a feed type first before adjusting inventory.
            </p>
            <button type="button" className="secondary-button btn btn-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ padding: "0 24px 24px" }}>
            {/* Feed Variety Selection */}
            <div className="form-group">
              <label htmlFor="adjust-feed-select">
                Select Feed Variety <span style={{ color: "var(--alert-danger)" }}>*</span>
              </label>
              <select
                id="adjust-feed-select"
                value={feedTypeId}
                onChange={(e) => handleFeedChange(e.target.value)}
                required
              >
                {feedTypes.map((ft) => (
                  <option key={ft.id} value={ft.id}>
                    {ft.name} — Current: {Number(ft.currentStock)} {ft.unit}
                    {ft.minimumStock > 0 ? ` (Min: ${ft.minimumStock} ${ft.unit})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Movement Type & Direction */}
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="adjust-type">Movement Type</label>
                <select
                  id="adjust-type"
                  value={type}
                  onChange={(e) => handleTypeChange(e.target.value)}
                >
                  <option value="ADJUSTMENT">Physical Stock Adjustment</option>
                  <option value="WASTAGE">Damage / Spillage / Wastage</option>
                  <option value="RETURN">Return to Supplier</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="adjust-direction">Direction</label>
                <select
                  id="adjust-direction"
                  value={direction}
                  onChange={(e) => setDirection(e.target.value)}
                  disabled={type === "WASTAGE" || type === "RETURN"}
                >
                  <option value="SUBTRACT">Decrease (-) Stock Deduction</option>
                  <option value="ADD">Increase (+) Stock Addition</option>
                </select>
                {(type === "WASTAGE" || type === "RETURN") && (
                  <span style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                    {type === "WASTAGE" ? "Wastage always reduces stock." : "Returns always reduce stock."}
                  </span>
                )}
              </div>
            </div>

            {/* Quantity and Date with optional unit conversion */}
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="adjust-quantity">
                  Quantity <span style={{ color: "var(--alert-danger)" }}>*</span>
                </label>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    id="adjust-quantity"
                    type="number"
                    step="any"
                    min="0.01"
                    placeholder="e.g. 10"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    required
                    style={{ flex: 1 }}
                  />
                  {hasBagConversion ? (
                    <select
                      value={selectedUnit}
                      onChange={(e) => setSelectedUnit(e.target.value)}
                      style={{ width: "90px", flexShrink: 0 }}
                      title={`Conversion rate: 1 bag = ${bagWeight} kg`}
                    >
                      <option value="kg">kg</option>
                      <option value="bags">bags</option>
                    </select>
                  ) : (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        padding: "0 12px",
                        background: "var(--bg-surface-subtle)",
                        border: "1px solid var(--border-default)",
                        borderRadius: "var(--radius-sm)",
                        fontSize: "13px",
                        fontWeight: 600,
                        color: "var(--text-secondary)",
                      }}
                    >
                      {feedUnit}
                    </span>
                  )}
                </div>
                {hasBagConversion && (
                  <span style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "3px" }}>
                    Standard bag weight: <strong>{bagWeight} kg/bag</strong>
                  </span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="adjust-date">
                  Adjustment Date <span style={{ color: "var(--alert-danger)" }}>*</span>
                </label>
                <input
                  id="adjust-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Live Stock Calculation Telemetry */}
            {currentFeed && numQty > 0 && (
              <div
                style={{
                  padding: "12px 16px",
                  background: wouldExceedStock
                    ? "var(--alert-danger-bg)"
                    : isBelowMinStock
                    ? "var(--alert-amber-bg)"
                    : "var(--field-50)",
                  border: `1px solid ${
                    wouldExceedStock
                      ? "var(--alert-danger-border)"
                      : isBelowMinStock
                      ? "var(--alert-amber-border)"
                      : "var(--field-100)"
                  }`,
                  borderRadius: "var(--radius-md)",
                  fontSize: "13px",
                  marginBottom: "16px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                  <span style={{ color: "var(--text-secondary)" }}>Current On-hand Stock:</span>
                  <strong>
                    {currentStock} {feedUnit}
                  </strong>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                  <span style={{ color: "var(--text-secondary)" }}>Stock Adjustment:</span>
                  <strong
                    style={{
                      color: signedQty < 0 ? "var(--alert-danger)" : "var(--alert-success)",
                    }}
                  >
                    {signedQty > 0 ? `+${numQty}` : `-${numQty}`} {selectedUnit}
                    {hasUnitConversion && (
                      <span style={{ fontSize: "12px", fontWeight: 500, marginLeft: "4px" }}>
                        ({signedQty > 0 ? `+${roundedEffectiveQty}` : roundedEffectiveQty} {feedUnit})
                      </span>
                    )}
                  </strong>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    paddingTop: "6px",
                    borderTop: "1px dashed rgba(0,0,0,0.12)",
                  }}
                >
                  <span style={{ fontWeight: 600 }}>New Stock After Adjustment:</span>
                  <strong
                    style={{
                      fontSize: "14px",
                      color: wouldExceedStock ? "var(--alert-danger)" : "var(--pine-900)",
                    }}
                  >
                    {previewStock} {feedUnit}
                  </strong>
                </div>

                {wouldExceedStock && (
                  <div
                    style={{
                      marginTop: "8px",
                      color: "var(--alert-danger)",
                      fontSize: "12px",
                      fontWeight: 600,
                    }}
                  >
                    ⚠️ Insufficient stock! Reductions cannot exceed currently available inventory.
                  </div>
                )}

                {isBelowMinStock && !wouldExceedStock && (
                  <div
                    style={{
                      marginTop: "8px",
                      color: "var(--alert-amber)",
                      fontSize: "12px",
                      fontWeight: 600,
                    }}
                  >
                    ⚠️ Warning: This adjustment will drop stock below the minimum threshold (
                    {currentFeed.minimumStock} {feedUnit}).
                  </div>
                )}
              </div>
            )}

            {/* Related House Association (Optional) */}
            {houses.length > 0 && (
              <div className="form-group">
                <label htmlFor="adjust-house">Related Poultry House (Optional)</label>
                <select
                  id="adjust-house"
                  value={houseId}
                  onChange={(e) => setHouseId(e.target.value)}
                >
                  <option value="">Whole Farm / Central Feed Store</option>
                  {houses.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                  Attribute this adjustment or wastage to a specific house or keep as general inventory.
                </span>
              </div>
            )}

            {/* Reason / Notes */}
            <div className="form-group">
              <label htmlFor="adjust-reason">
                Reason / Details <span style={{ color: "var(--alert-danger)" }}>*</span>
              </label>
              <input
                id="adjust-reason"
                type="text"
                placeholder="e.g. Moisture damage after rain, physical count correction..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
              />

              {/* Quick Presets */}
              <div style={{ marginTop: "8px" }}>
                <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>
                  Quick presets:
                </span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {commonPresets.map((preset) => {
                    const isSelected = reason === preset.label;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        className={`filter-btn ${isSelected ? "active" : ""}`}
                        style={{
                          fontSize: "11px",
                          padding: "3px 8px",
                          lineHeight: "1.2",
                        }}
                        onClick={() => handleApplyPreset(preset)}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Form Actions */}
            <div className="form-actions modal-actions">
              <button
                type="button"
                className="secondary-button btn btn-secondary"
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="primary-button btn btn-primary"
                disabled={loading || wouldExceedStock || !numQty}
              >
                {loading ? "Recording..." : "Apply Adjustment"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default StockAdjustmentModal;
