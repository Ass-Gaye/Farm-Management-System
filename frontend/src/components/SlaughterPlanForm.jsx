import { useState } from "react";
import { createSlaughterPlan, updateSlaughterPlan } from "../services/api";

function SlaughterPlanForm({
  houseId,
  breeds = [],
  currentBirdsInHouse = 0,
  plan,
  onSuccess,
  onCancel,
}) {
  const isEditing = Boolean(plan);

  const [formData, setFormData] = useState(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    const slaughterTarget = new Date();
    slaughterTarget.setDate(slaughterTarget.getDate() + 35);
    const defaultSlaughterStr = slaughterTarget.toISOString().split("T")[0];

    return {
      breedId: plan?.breedId ? String(plan.breedId) : "",
      numberOfBirds: plan?.numberOfBirds ? String(plan.numberOfBirds) : "",
      placementDate: plan?.placementDate
        ? new Date(plan.placementDate).toISOString().split("T")[0]
        : todayStr,
      expectedSlaughterDate: plan?.expectedSlaughterDate
        ? new Date(plan.expectedSlaughterDate).toISOString().split("T")[0]
        : defaultSlaughterStr,
      status: plan?.status || "Upcoming",
      notes: plan?.notes || "",
    };
  });

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

    const birdCount = Number(formData.numberOfBirds);
    if (!formData.numberOfBirds || isNaN(birdCount) || birdCount <= 0) {
      setError("Number of birds must be a positive number greater than 0.");
      return;
    }

    if (birdCount > maxAllowedBirds) {
      setError(
        `Slaughter bird count (${birdCount}) cannot exceed available birds (${maxAllowedBirds}) for ${
          selectedBreed ? `breed "${selectedBreed.name}"` : "this house"
        }.`
      );
      return;
    }

    if (!formData.placementDate) {
      setError("Placement date is required.");
      return;
    }

    if (!formData.expectedSlaughterDate) {
      setError("Expected slaughter date is required.");
      return;
    }

    const pDate = new Date(formData.placementDate);
    const sDate = new Date(formData.expectedSlaughterDate);

    if (sDate < pDate) {
      setError("Expected slaughter date cannot be earlier than placement date.");
      return;
    }

    try {
      setSaving(true);
      const payload = {
        houseId,
        breedId: formData.breedId ? Number(formData.breedId) : null,
        numberOfBirds: birdCount,
        placementDate: formData.placementDate,
        expectedSlaughterDate: formData.expectedSlaughterDate,
        status: formData.status,
        notes: formData.notes.trim() || null,
      };

      let result;
      if (isEditing) {
        result = await updateSlaughterPlan(plan.id, payload);
      } else {
        result = await createSlaughterPlan(payload);
      }

      onSuccess(result.data);
    } catch (err) {
      setError(err.message || "Failed to save slaughter plan.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="form-card">
      <div className="form-header">
        <div>
          <h2>{isEditing ? "Edit Slaughter Plan" : "New Slaughter Plan"}</h2>
          <p>
            Plan harvest schedules and record expected slaughter dates.
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
            <label htmlFor="slaughter-breed">Select Breed (Optional)</label>
            <select
              id="slaughter-breed"
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
            <label htmlFor="slaughter-birds">Number of Birds *</label>
            <input
              id="slaughter-birds"
              name="numberOfBirds"
              type="number"
              min="1"
              max={maxAllowedBirds}
              step="1"
              placeholder={`Max ${maxAllowedBirds}`}
              value={formData.numberOfBirds}
              onChange={handleChange}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="placement-date">Placement Date *</label>
            <input
              id="placement-date"
              name="placementDate"
              type="date"
              value={formData.placementDate}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label htmlFor="expected-slaughter-date">
              Expected Slaughter Date *
            </label>
            <input
              id="expected-slaughter-date"
              name="expectedSlaughterDate"
              type="date"
              min={formData.placementDate}
              value={formData.expectedSlaughterDate}
              onChange={handleChange}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="slaughter-status">Plan Status</label>
            <select
              id="slaughter-status"
              name="status"
              value={formData.status}
              onChange={handleChange}
            >
              <option value="Upcoming">Upcoming</option>
              <option value="Completed">Completed</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="slaughter-notes">Notes & Market Details</label>
            <input
              id="slaughter-notes"
              name="notes"
              type="text"
              placeholder="e.g. Target live weight 2.2kg, Hotel contract #4"
              value={formData.notes}
              onChange={handleChange}
            />
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="secondary-button" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="primary-button" disabled={saving}>
            {saving
              ? "Saving..."
              : isEditing
              ? "Update Plan"
              : "Schedule Slaughter"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default SlaughterPlanForm;
