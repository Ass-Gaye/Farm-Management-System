import { useState, useEffect } from "react";
import { createFeedType, updateFeedType } from "../services/api";

const getInitialFormData = (feedType) =>
  feedType
    ? {
        name: feedType.name || "",
        category: feedType.category || "FEED",
        description: feedType.description || "",
        unit: feedType.unit || "kg",
        bagWeightKg: feedType.bagWeightKg || 50,
        minimumStock: feedType.minimumStock !== undefined ? feedType.minimumStock : 0,
        currentStock: feedType.currentStock !== undefined ? feedType.currentStock : 0,
        unitCost: feedType.unitCost !== undefined ? feedType.unitCost : 0,
        active: feedType.active !== undefined ? feedType.active : true,
      }
    : {
        name: "",
        category: "FEED",
        description: "",
        unit: "kg",
        bagWeightKg: 50,
        minimumStock: 100,
        currentStock: 0,
        unitCost: 0,
        active: true,
      };

function FeedTypeModal({ isOpen, onClose, onSaved, feedType = null }) {
  const [formData, setFormData] = useState(() => getInitialFormData(feedType));

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isEditing = Boolean(feedType);

  useEffect(() => {
    if (isOpen) {
      setFormData(getInitialFormData(feedType));
      setError("");
    }
  }, [isOpen, feedType]);

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

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!formData.name.trim()) {
      setError("Feed type name is required");
      return;
    }

    if (formData.unit.toLowerCase().includes("bag")) {
      const bw = Number(formData.bagWeightKg);
      if (!bw || bw <= 0) {
        setError("A valid bag weight (greater than 0 kg) is required when unit is bags.");
        return;
      }
    }

    try {
      setLoading(true);

      const payload = {
        name: formData.name.trim(),
        category: formData.category.trim(),
        description: formData.description?.trim() || null,
        unit: formData.unit.trim(),
        bagWeightKg: formData.unit.toLowerCase().includes("bag")
          ? Number(formData.bagWeightKg) || 50
          : null,
        minimumStock: Number(formData.minimumStock) || 0,
        unitCost: Number(formData.unitCost) || 0,
        active: formData.active,
      };

      if (!isEditing) {
        payload.currentStock = Number(formData.currentStock) || 0;
        await createFeedType(payload);
      } else {
        await updateFeedType(feedType.id, payload);
      }

      onSaved();
      onClose();
    } catch (err) {
      setError(err.message || "Failed to save feed type");
    } finally {
      setLoading(false);
    }
  };

  const commonPresets = [
    "Layer Feed",
    "Broiler Starter",
    "Broiler Grower",
    "Broiler Finisher",
    "Chick Mash",
  ];

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <div>
            <h3>{isEditing ? "Edit Feed Type" : "Add New Feed Type"}</h3>
            <p className="modal-subtitle">
              Define feed units, stock thresholds, and opening inventory.
            </p>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>

        {error && <div className="alert-banner alert-error" style={{ margin: "0 24px 16px" }}>{error}</div>}

        <form onSubmit={handleSubmit} className="form-stack" style={{ padding: "0 24px 24px" }}>
          {/* Quick presets for common feeds if creating new */}
          {!isEditing && (
            <div className="form-group mb-2">
              <label className="text-xs text-muted">Quick Presets:</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "4px" }}>
                {commonPresets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: "11px", padding: "3px 8px" }}
                    onClick={() => setFormData((prev) => ({ ...prev, name: preset }))}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="feed-name">
              Feed Name <span className="required">*</span>
            </label>
            <input
              id="feed-name"
              type="text"
              name="name"
              className="form-control"
              placeholder="e.g. Layer Feed"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group col-6">
              <label htmlFor="feed-unit">Unit of Measure</label>
              <select
                id="feed-unit"
                name="unit"
                className="form-control"
                value={formData.unit}
                onChange={handleChange}
              >
                <option value="kg">Kilograms (kg)</option>
                <option value="bags">Bags (with configurable bag weight)</option>
              </select>
            </div>

            {formData.unit.toLowerCase().includes("bag") && (
              <div className="form-group col-6">
                <label htmlFor="feed-bag-weight">Weight per Bag (kg)</label>
                <input
                  id="feed-bag-weight"
                  type="number"
                  step="any"
                  name="bagWeightKg"
                  className="form-control"
                  value={formData.bagWeightKg}
                  onChange={handleChange}
                  placeholder="50"
                  min="1"
                />
              </div>
            )}
          </div>

          <div className="form-row">
            <div className="form-group col-6">
              <label htmlFor="feed-min-stock">
                Minimum Stock Level ({formData.unit})
              </label>
              <input
                id="feed-min-stock"
                type="number"
                step="any"
                name="minimumStock"
                className="form-control"
                value={formData.minimumStock}
                onChange={handleChange}
                min="0"
                placeholder="Alert threshold"
              />
              <span className="form-hint">Triggers LOW STOCK badge when reached.</span>
            </div>

            <div className="form-group col-6">
              <label htmlFor="feed-unit-cost">
                Estimated Unit Cost (GMD/{formData.unit})
              </label>
              <input
                id="feed-unit-cost"
                type="number"
                step="any"
                name="unitCost"
                className="form-control"
                value={formData.unitCost}
                onChange={handleChange}
                min="0"
                placeholder="0.00"
              />
            </div>
          </div>

          {!isEditing && (
            <div className="form-group">
              <label htmlFor="feed-current-stock">
                Initial Opening Stock ({formData.unit})
              </label>
              <input
                id="feed-current-stock"
                type="number"
                step="any"
                name="currentStock"
                className="form-control"
                value={formData.currentStock}
                onChange={handleChange}
                min="0"
                placeholder="0"
              />
              <span className="form-hint">
                Enter current physical stock on hand to create opening inventory.
              </span>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="feed-description">Description / Notes</label>
            <textarea
              id="feed-description"
              name="description"
              rows={2}
              className="form-control"
              placeholder="e.g. 18% protein layer feed from ABC Mill"
              value={formData.description}
              onChange={handleChange}
            />
          </div>

          <div className="form-group checkbox-group" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <input
              id="feed-active"
              type="checkbox"
              name="active"
              checked={formData.active}
              onChange={handleChange}
            />
            <label htmlFor="feed-active" style={{ marginBottom: 0 }}>
              Active (available for daily records and purchase logging)
            </label>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? "Saving..." : isEditing ? "Save Changes" : "Create Feed Type"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default FeedTypeModal;
