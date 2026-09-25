import { useState, useEffect } from "react";
import { createDailyRecordCorrection } from "../services/api";

function CorrectionModal({ isOpen, onClose, onSaved, record }) {
  const [field, setField] = useState("MORTALITY");
  const [correctedValue, setCorrectedValue] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      setField("MORTALITY");
      setCorrectedValue("");
      setReason("");
      setError("");
      setLoading(false);
    }
  }, [isOpen, record]);

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

  if (!isOpen || !record) return null;

  const rawValue = field === "MORTALITY" ? record.mortality : record.eggsCollected;
  const previousValue =
    field === "MORTALITY"
      ? record.correctedMortality ?? rawValue
      : record.correctedEggs ?? rawValue;
  const correctedNum = correctedValue === "" ? null : Number(correctedValue);
  const adjustment = correctedNum === null || isNaN(correctedNum) ? null : correctedNum - previousValue;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (correctedNum === null || isNaN(correctedNum) || !Number.isInteger(correctedNum) || correctedNum < 0) {
      setError("Corrected value must be a non-negative whole number.");
      return;
    }
    if (!reason.trim()) {
      setError("A reason is required for corrections.");
      return;
    }
    try {
      setLoading(true);
      await createDailyRecordCorrection(record.id, {
        field,
        correctedValue: correctedNum,
        reason: reason.trim(),
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message || "Failed to record correction");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <div>
            <h3>Correct Historical Record</h3>
            <p className="modal-subtitle">
              The original entry stays unchanged; a correction is appended to the audit trail.
            </p>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>

        {error && <div className="alert-banner alert-error" style={{ margin: "0 24px 16px" }}>{error}</div>}

        <form onSubmit={handleSubmit} className="form-stack" style={{ padding: "0 24px 24px" }}>
          <div className="form-group">
            <label htmlFor="correction-field">What needs correction?</label>
            <select
              id="correction-field"
              className="form-control"
              value={field}
              onChange={(e) => { setField(e.target.value); setCorrectedValue(""); }}
            >
              <option value="MORTALITY">Mortality (birds)</option>
              <option value="EGGS">Eggs collected</option>
            </select>
            <span className="form-hint">
              Feed corrections are recorded through Inventory → Adjust / Wastage with a reason
              referencing this record.
            </span>
          </div>

          <div className="form-row">
            <div className="form-group col-6">
              <label>Previous value</label>
              <input className="form-control" value={previousValue} disabled readOnly />
            </div>
            <div className="form-group col-6">
              <label htmlFor="correction-value">Corrected value *</label>
              <input
                id="correction-value"
                type="number"
                min="0"
                step="1"
                className="form-control"
                value={correctedValue}
                onChange={(e) => setCorrectedValue(e.target.value)}
                placeholder={String(previousValue)}
                required
              />
            </div>
          </div>

          {adjustment !== null && !isNaN(adjustment) && (
            <div
              style={{
                padding: "8px 12px", borderRadius: 8, marginBottom: 16, fontSize: 12,
                background: "#f8fafc", border: "1px solid #e2e8f0",
              }}
            >
              Adjustment: <strong>{adjustment > 0 ? `+${adjustment}` : adjustment}</strong>
              {adjustment === 0 && <span> (no change — nothing will be recorded)</span>}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="correction-reason">Reason *</label>
            <textarea
              id="correction-reason"
              rows={2}
              className="form-control"
              placeholder="e.g. recount showed 15, not 20"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "Saving..." : "Record Correction"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CorrectionModal;
