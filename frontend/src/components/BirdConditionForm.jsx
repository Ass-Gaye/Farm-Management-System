import { useState } from "react";
import { createBirdCondition, updateBirdCondition } from "../services/api";

function BirdConditionForm({
  houseId,
  breeds = [],
  currentBirdsInHouse = 0,
  condition,
  onSuccess,
  onCancel,
}) {
  const isEditing = Boolean(condition);

  const [formData, setFormData] = useState(() => ({
    breedId: condition?.breedId ? String(condition.breedId) : "",
    healthy: condition ? String(condition.healthy) : "",
    sick: condition ? String(condition.sick) : "0",
    weak: condition ? String(condition.weak) : "0",
    underObservation: condition ? String(condition.underObservation) : "0",
    recordDate: condition?.recordDate
      ? new Date(condition.recordDate).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0],
    notes: condition?.notes || "",
  }));

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedBreed = breeds.find((b) => b.id === Number(formData.breedId));
  const maxAllowedBirds = selectedBreed ? selectedBreed.numberOfBirds : currentBirdsInHouse;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const healthy = Number(formData.healthy || 0);
    const sick = Number(formData.sick || 0);
    const weak = Number(formData.weak || 0);
    const underObservation = Number(formData.underObservation || 0);

    if (
      healthy < 0 ||
      sick < 0 ||
      weak < 0 ||
      underObservation < 0 ||
      !Number.isInteger(healthy) ||
      !Number.isInteger(sick) ||
      !Number.isInteger(weak) ||
      !Number.isInteger(underObservation)
    ) {
      setError("All bird counts must be non-negative whole numbers (0 or greater).");
      return;
    }

    const totalConditionCount = healthy + sick + weak + underObservation;
    if (totalConditionCount === 0) {
      setError("Please record at least 1 bird in the condition check.");
      return;
    }

    if (totalConditionCount > maxAllowedBirds) {
      setError(
        `Total condition count (${totalConditionCount}) exceeds available birds (${maxAllowedBirds}) for ${
          selectedBreed ? `breed "${selectedBreed.name}"` : "this poultry house"
        }.`
      );
      return;
    }

    try {
      setSaving(true);
      const payload = {
        houseId,
        breedId: formData.breedId ? Number(formData.breedId) : null,
        healthy,
        sick,
        weak,
        underObservation,
        notes: formData.notes.trim() || null,
        recordDate: formData.recordDate,
      };

      let result;
      if (isEditing) {
        result = await updateBirdCondition(condition.id, payload);
      } else {
        result = await createBirdCondition(payload);
      }

      onSuccess(result.data);
    } catch (err) {
      setError(err.message || "Failed to save condition record.");
    } finally {
      setSaving(false);
    }
  };

  const totalBirdsEntered =
    (Number(formData.healthy) || 0) +
    (Number(formData.sick) || 0) +
    (Number(formData.weak) || 0) +
    (Number(formData.underObservation) || 0);

  return (
    <div className="form-card">
      <div className="form-header">
        <div>
          <h2>{isEditing ? "Edit Health & Condition" : "Record Bird Condition"}</h2>
          <p>
            Track health status (healthy, sick, weak, and under observation).
          </p>
        </div>
        <button type="button" className="close-button" onClick={onCancel}>
          ×
        </button>
      </div>

      {error && <div className="form-error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="condition-breed">Select Breed (Optional)</label>
            <select
              id="condition-breed"
              name="breedId"
              value={formData.breedId}
              onChange={handleChange}
            >
              <option value="">Whole House / General Flock</option>
              {breeds.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.numberOfBirds} birds)
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="condition-date">Record Date</label>
            <input
              id="condition-date"
              name="recordDate"
              type="date"
              value={formData.recordDate}
              onChange={handleChange}
            />
          </div>
        </div>

        <div className="condition-counter-hint">
          <span>Max Available: <strong>{maxAllowedBirds} birds</strong></span>
          <span className={totalBirdsEntered > maxAllowedBirds ? "counter-over" : "counter-ok"}>
            Total Counted: <strong>{totalBirdsEntered} birds</strong>
          </span>
        </div>

        <div className="form-row form-row-4">
          <div className="form-group">
            <label htmlFor="condition-healthy" className="label-healthy">
              Healthy
            </label>
            <input
              id="condition-healthy"
              name="healthy"
              type="number"
              min="0"
              step="1"
              placeholder="0"
              value={formData.healthy}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label htmlFor="condition-sick" className="label-sick">
              Sick
            </label>
            <input
              id="condition-sick"
              name="sick"
              type="number"
              min="0"
              step="1"
              placeholder="0"
              value={formData.sick}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label htmlFor="condition-weak" className="label-weak">
              Weak
            </label>
            <input
              id="condition-weak"
              name="weak"
              type="number"
              min="0"
              step="1"
              placeholder="0"
              value={formData.weak}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label htmlFor="condition-observation" className="label-obs">
              Under Observation
            </label>
            <input
              id="condition-observation"
              name="underObservation"
              type="number"
              min="0"
              step="1"
              placeholder="0"
              value={formData.underObservation}
              onChange={handleChange}
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="condition-notes">Observations & Clinical Notes</label>
          <textarea
            id="condition-notes"
            name="notes"
            rows="3"
            placeholder="e.g. Birds showing mild respiratory symptoms, separated into isolation pen 2"
            value={formData.notes}
            onChange={handleChange}
          ></textarea>
        </div>

        <div className="form-actions">
          <button type="button" className="secondary-button" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="submit"
            className="primary-button"
            disabled={saving || totalBirdsEntered > maxAllowedBirds}
          >
            {saving
              ? "Saving..."
              : isEditing
              ? "Update Record"
              : "Save Condition Record"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default BirdConditionForm;
