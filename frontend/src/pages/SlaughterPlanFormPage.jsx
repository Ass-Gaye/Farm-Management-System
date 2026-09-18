import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useFarm } from "../context/useFarm";
import FullScreenFormLayout from "../components/common/FullScreenFormLayout";
import {
  createSlaughterPlan,
  updateSlaughterPlan,
  getSlaughterPlanById,
} from "../services/api";

function SlaughterPlanFormPage() {
  const { id } = useParams();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const {
    selectedHouse,
    breeds,
    currentBirdsInHouse,
    slaughterPlans,
    reloadHouseData,
    showToast,
  } = useFarm();

  const existingPlan = isEditing
    ? slaughterPlans.find((p) => p.id === Number(id))
    : null;

  const [formData, setFormData] = useState(() => {
    if (existingPlan) {
      return {
        breedId: existingPlan.breedId ? String(existingPlan.breedId) : "",
        numberOfBirds: String(existingPlan.numberOfBirds || ""),
        placementDate: existingPlan.placementDate
          ? new Date(existingPlan.placementDate).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0],
        expectedSlaughterDate: existingPlan.expectedSlaughterDate
          ? new Date(existingPlan.expectedSlaughterDate).toISOString().split("T")[0]
          : "",
        status: existingPlan.status || "Upcoming",
        notes: existingPlan.notes || "",
      };
    }

    const todayStr = new Date().toISOString().split("T")[0];
    const slaughterTarget = new Date();
    slaughterTarget.setDate(slaughterTarget.getDate() + 35);
    const defaultSlaughterStr = slaughterTarget.toISOString().split("T")[0];

    return {
      breedId: "",
      numberOfBirds: "",
      placementDate: todayStr,
      expectedSlaughterDate: defaultSlaughterStr,
      status: "Upcoming",
      notes: "",
    };
  });

  const [loadingPlan, setLoadingPlan] = useState(
    Boolean(isEditing && !existingPlan)
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEditing || existingPlan) return;

    let cancelled = false;
    const fetchPlan = async () => {
      try {
        const result = await getSlaughterPlanById(id);
        if (!cancelled && result.data) {
          const p = result.data;
          setFormData({
            breedId: p.breedId ? String(p.breedId) : "",
            numberOfBirds: String(p.numberOfBirds || ""),
            placementDate: p.placementDate
              ? new Date(p.placementDate).toISOString().split("T")[0]
              : new Date().toISOString().split("T")[0],
            expectedSlaughterDate: p.expectedSlaughterDate
              ? new Date(p.expectedSlaughterDate).toISOString().split("T")[0]
              : "",
            status: p.status || "Upcoming",
            notes: p.notes || "",
          });
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Failed to load slaughter plan details.");
        }
      } finally {
        if (!cancelled) {
          setLoadingPlan(false);
        }
      }
    };

    fetchPlan();

    return () => {
      cancelled = true;
    };
  }, [id, isEditing, existingPlan]);

  const selectedBreed = breeds.find((b) => b.id === Number(formData.breedId));
  const maxAllowedBirds = selectedBreed
    ? selectedBreed.numberOfBirds
    : currentBirdsInHouse;

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? (checked ? "Completed" : "Upcoming") : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const birdCount = Number(formData.numberOfBirds);
    if (!formData.numberOfBirds || isNaN(birdCount) || birdCount <= 0 || !Number.isInteger(birdCount)) {
      setError("Number of birds must be a positive whole number greater than 0.");
      return;
    }

    if (birdCount > maxAllowedBirds) {
      setError(
        `Slaughter bird count (${birdCount}) cannot exceed available birds (${maxAllowedBirds}) for ${
          selectedBreed ? `breed "${selectedBreed.name}"` : "this poultry house"
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

    if (!selectedHouse?.id) {
      setError("No poultry house selected.");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        houseId: selectedHouse.id,
        breedId: formData.breedId ? Number(formData.breedId) : null,
        numberOfBirds: birdCount,
        placementDate: formData.placementDate,
        expectedSlaughterDate: formData.expectedSlaughterDate,
        status: formData.status,
        notes: formData.notes.trim() || null,
      };

      if (isEditing) {
        await updateSlaughterPlan(id, payload);
        showToast("Slaughter plan updated successfully.");
      } else {
        await createSlaughterPlan(payload);
        showToast("Slaughter plan scheduled successfully.");
      }

      await reloadHouseData();
      navigate("/slaughter-planning");
    } catch (err) {
      setError(err.message || "Failed to save slaughter plan.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <FullScreenFormLayout
      title={isEditing ? "Edit Slaughter Plan" : "Schedule Slaughter Plan"}
      subtitle={
        isEditing
          ? "Update harvest timeline, planned quantities, and batch completion status."
          : `Schedule a planned harvest date for ${selectedHouse?.name || "this poultry house"}.`
      }
      backPath="/slaughter-planning"
      backLabel="Back to Slaughter Planning"
      onCancel={() => navigate("/slaughter-planning")}
    >
      {loadingPlan ? (
        <div style={{ textAlign: "center", padding: "40px 0" }}>
          <div className="loading-spinner" style={{ margin: "0 auto 12px" }}></div>
          <p style={{ color: "var(--text-muted)" }}>Loading slaughter plan details...</p>
        </div>
      ) : (
        <>
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
                <label htmlFor="slaughter-birds">Number of Birds Planned *</label>
                <input
                  id="slaughter-birds"
                  name="numberOfBirds"
                  type="number"
                  min="1"
                  step="1"
                  placeholder="e.g. 100"
                  value={formData.numberOfBirds}
                  onChange={handleChange}
                  required
                />
                <span style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                  Max available: {maxAllowedBirds} birds
                </span>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="placement-date">Placement / Hatch Date *</label>
                <input
                  id="placement-date"
                  name="placementDate"
                  type="date"
                  value={formData.placementDate}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="expected-slaughter-date">Target Slaughter Date *</label>
                <input
                  id="expected-slaughter-date"
                  name="expectedSlaughterDate"
                  type="date"
                  value={formData.expectedSlaughterDate}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="slaughter-status">Batch Status</label>
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
              <label htmlFor="slaughter-notes">Notes / Harvest Logistics</label>
              <textarea
                id="slaughter-notes"
                name="notes"
                rows="3"
                placeholder="e.g. Broiler batch target weight 2.2kg, destined for local market customer."
                value={formData.notes}
                onChange={handleChange}
              ></textarea>
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => navigate("/slaughter-planning")}
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
                  ? "Saving Plan..."
                  : isEditing
                  ? "Save Changes"
                  : "Schedule Slaughter Plan"}
              </button>
            </div>
          </form>
        </>
      )}
    </FullScreenFormLayout>
  );
}

export default SlaughterPlanFormPage;
