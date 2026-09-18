import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useFarm } from "../context/useFarm";
import FullScreenFormLayout from "../components/common/FullScreenFormLayout";
import {
  createBirdCondition,
  updateBirdCondition,
  getBirdConditionById,
} from "../services/api";

function HealthConditionFormPage() {
  const { id } = useParams();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const {
    selectedHouse,
    breeds,
    currentBirdsInHouse,
    conditions,
    reloadHouseData,
    showToast,
  } = useFarm();

  const existingCondition = isEditing
    ? conditions.find((c) => c.id === Number(id))
    : null;

  const [formData, setFormData] = useState(() => {
    if (existingCondition) {
      return {
        breedId: existingCondition.breedId ? String(existingCondition.breedId) : "",
        healthy: String(existingCondition.healthy ?? ""),
        sick: String(existingCondition.sick ?? "0"),
        weak: String(existingCondition.weak ?? "0"),
        underObservation: String(existingCondition.underObservation ?? "0"),
        recordDate: existingCondition.recordDate
          ? new Date(existingCondition.recordDate).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0],
        notes: existingCondition.notes || "",
      };
    }
    return {
      breedId: "",
      healthy: "",
      sick: "0",
      weak: "0",
      underObservation: "0",
      recordDate: new Date().toISOString().split("T")[0],
      notes: "",
    };
  });

  const [loadingCondition, setLoadingCondition] = useState(
    Boolean(isEditing && !existingCondition)
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEditing || existingCondition) return;

    let cancelled = false;
    const fetchCondition = async () => {
      try {
        const result = await getBirdConditionById(id);
        if (!cancelled && result.data) {
          const d = result.data;
          setFormData({
            breedId: d.breedId ? String(d.breedId) : "",
            healthy: String(d.healthy ?? ""),
            sick: String(d.sick ?? "0"),
            weak: String(d.weak ?? "0"),
            underObservation: String(d.underObservation ?? "0"),
            recordDate: d.recordDate
              ? new Date(d.recordDate).toISOString().split("T")[0]
              : new Date().toISOString().split("T")[0],
            notes: d.notes || "",
          });
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Failed to load health inspection details.");
        }
      } finally {
        if (!cancelled) {
          setLoadingCondition(false);
        }
      }
    };

    fetchCondition();

    return () => {
      cancelled = true;
    };
  }, [id, isEditing, existingCondition]);

  const selectedBreed = breeds.find((b) => b.id === Number(formData.breedId));
  const maxAllowedBirds = selectedBreed
    ? selectedBreed.numberOfBirds
    : currentBirdsInHouse;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const healthy = Number(formData.healthy || 0);
  const sick = Number(formData.sick || 0);
  const weak = Number(formData.weak || 0);
  const underObservation = Number(formData.underObservation || 0);
  const totalBirdsEntered = healthy + sick + weak + underObservation;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

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

    if (totalBirdsEntered === 0) {
      setError("Please record at least 1 bird in the condition assessment.");
      return;
    }

    if (totalBirdsEntered > maxAllowedBirds) {
      setError(
        `Total condition count (${totalBirdsEntered}) exceeds available birds (${maxAllowedBirds}) for ${
          selectedBreed ? `breed "${selectedBreed.name}"` : "this poultry house"
        }.`
      );
      return;
    }

    if (!selectedHouse?.id) {
      setError("No poultry house selected.");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        houseId: selectedHouse.id,
        breedId: formData.breedId ? Number(formData.breedId) : null,
        healthy,
        sick,
        weak,
        underObservation,
        notes: formData.notes.trim() || null,
        recordDate: formData.recordDate,
      };

      if (isEditing) {
        await updateBirdCondition(id, payload);
        showToast("Health inspection record updated successfully.");
      } else {
        await createBirdCondition(payload);
        showToast("Health inspection record saved successfully.");
      }

      await reloadHouseData();
      navigate("/health-condition");
    } catch (err) {
      setError(err.message || "Failed to save health condition record.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <FullScreenFormLayout
      title={isEditing ? "Edit Health & Condition Record" : "Record Flock Health & Condition"}
      subtitle={
        isEditing
          ? "Update health metrics and condition details for this inspection date."
          : `Record bird health check for ${selectedHouse?.name || "this poultry house"}.`
      }
      backPath="/health-condition"
      backLabel="Back to Health & Condition"
      onCancel={() => navigate("/health-condition")}
    >
      {loadingCondition ? (
        <div style={{ textAlign: "center", padding: "40px 0" }}>
          <div className="loading-spinner" style={{ margin: "0 auto 12px" }}></div>
          <p style={{ color: "var(--text-muted)" }}>Loading health record details...</p>
        </div>
      ) : (
        <>
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
                <label htmlFor="condition-date">Inspection Date *</label>
                <input
                  id="condition-date"
                  name="recordDate"
                  type="date"
                  value={formData.recordDate}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            {/* Live Count Validation Display */}
            <div className="condition-counter-hint">
              <span>
                Available Scope:{" "}
                <strong>
                  {selectedBreed
                    ? `${selectedBreed.name} (${maxAllowedBirds} birds)`
                    : `Whole House (${maxAllowedBirds} birds)`}
                </strong>
              </span>
              <span
                className={
                  totalBirdsEntered > maxAllowedBirds
                    ? "counter-over"
                    : "counter-ok"
                }
              >
                Birds Accounted For: <strong>{totalBirdsEntered}</strong> /{" "}
                {maxAllowedBirds}
              </span>
            </div>

            <div className="form-row-4">
              <div className="form-group">
                <label htmlFor="cond-healthy" className="label-healthy">
                  Healthy *
                </label>
                <input
                  id="cond-healthy"
                  name="healthy"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="0"
                  value={formData.healthy}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="cond-sick" className="label-sick">
                  Sick
                </label>
                <input
                  id="cond-sick"
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
                <label htmlFor="cond-weak" className="label-weak">
                  Weak
                </label>
                <input
                  id="cond-weak"
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
                <label htmlFor="cond-obs" className="label-obs">
                  Observation
                </label>
                <input
                  id="cond-obs"
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
              <label htmlFor="cond-notes">Inspection Notes / Symptoms</label>
              <textarea
                id="cond-notes"
                name="notes"
                rows="3"
                placeholder="e.g. 2 birds isolated for respiratory checks; antibiotic treatment commenced."
                value={formData.notes}
                onChange={handleChange}
              ></textarea>
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => navigate("/health-condition")}
                disabled={saving}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="primary-button"
                disabled={saving}
              >
                {saving
                  ? "Saving Health Log..."
                  : isEditing
                  ? "Save Changes"
                  : "Save Health Record"}
              </button>
            </div>
          </form>
        </>
      )}
    </FullScreenFormLayout>
  );
}

export default HealthConditionFormPage;
