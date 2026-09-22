import { useState, useEffect } from "react";
import { createDepopulationEvent, updateDepopulationEvent } from "../services/api";
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
  });

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

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
      });
    } else {
      setFormData({
        flockId: flockId ? String(flockId) : flocks?.[0]?.id ? String(flocks[0].id) : "",
        quantity: "",
        reason: "SOLD",
        date: new Date().toISOString().split("T")[0],
        notes: "",
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

    try {
      setSaving(true);
      const payload = {
        flockId: Number(formData.flockId),
        quantity: enteredQty,
        reason: formData.reason,
        date: new Date(formData.date).toISOString(),
        notes: formData.notes.trim() || null,
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
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
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
