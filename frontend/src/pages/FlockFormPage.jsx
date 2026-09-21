import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useFarm } from "../context/useFarm";
import FullScreenFormLayout from "../components/common/FullScreenFormLayout";
import { createFlock, updateFlock, getFlockById } from "../services/api";

function FlockFormPage() {
  const { id } = useParams();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const { selectedHouse, houses, breeds, reloadHouseData, showToast } = useFarm();

  const [formData, setFormData] = useState({
    houseId: selectedHouse ? String(selectedHouse.id) : "",
    breedId: "",
    name: "",
    batchNumber: "",
    purpose: "BROILER",
    birdsPlaced: "",
    placementDate: new Date().toISOString().split("T")[0],
    expectedMarketDate: "",
    targetWeightKg: "",
    status: "ACTIVE",
    notes: "",
  });

  const [loadingFlock, setLoadingFlock] = useState(isEditing);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEditing) return;

    let cancelled = false;
    const fetchFlock = async () => {
      try {
        const result = await getFlockById(id);
        if (!cancelled && result.data) {
          const f = result.data;
          setFormData({
            houseId: String(f.houseId),
            breedId: f.breedId ? String(f.breedId) : "",
            name: f.name || "",
            batchNumber: f.batchNumber || "",
            purpose: f.purpose || "BROILER",
            birdsPlaced: String(f.birdsPlaced || ""),
            placementDate: f.placementDate
              ? new Date(f.placementDate).toISOString().split("T")[0]
              : new Date().toISOString().split("T")[0],
            expectedMarketDate: f.expectedMarketDate
              ? new Date(f.expectedMarketDate).toISOString().split("T")[0]
              : "",
            targetWeightKg: f.targetWeightKg ? String(f.targetWeightKg) : "",
            status: f.status || "ACTIVE",
            notes: f.notes || "",
          });
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Failed to load flock batch details.");
        }
      } finally {
        if (!cancelled) {
          setLoadingFlock(false);
        }
      }
    };

    fetchFlock();

    return () => {
      cancelled = true;
    };
  }, [id, isEditing]);

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

    if (!formData.name.trim()) {
      setError("Flock name is required.");
      return;
    }

    const birds = Number(formData.birdsPlaced);
    if (!birds || isNaN(birds) || birds <= 0 || !Number.isInteger(birds)) {
      setError("Number of birds placed must be a whole positive number.");
      return;
    }

    if (!formData.placementDate) {
      setError("Placement date is required.");
      return;
    }

    const houseIdToUse = formData.houseId ? Number(formData.houseId) : selectedHouse?.id;
    if (!houseIdToUse) {
      setError("A poultry house must be selected.");
      return;
    }

    const payload = {
      houseId: houseIdToUse,
      breedId: formData.breedId ? Number(formData.breedId) : null,
      name: formData.name.trim(),
      batchNumber: formData.batchNumber.trim() || null,
      purpose: formData.purpose,
      birdsPlaced: birds,
      placementDate: new Date(formData.placementDate).toISOString(),
      expectedMarketDate: formData.expectedMarketDate
        ? new Date(formData.expectedMarketDate).toISOString()
        : null,
      targetWeightKg: formData.targetWeightKg ? Number(formData.targetWeightKg) : null,
      status: formData.status,
      notes: formData.notes.trim() || null,
    };

    try {
      setSaving(true);
      if (isEditing) {
        await updateFlock(id, payload);
        showToast("Flock batch updated successfully.");
      } else {
        await createFlock(payload);
        showToast("New flock batch created successfully.");
      }

      await reloadHouseData();
      navigate("/flocks");
    } catch (err) {
      setError(err.message || "Failed to save flock.");
    } finally {
      setSaving(false);
    }
  };

  if (loadingFlock) {
    return (
      <FullScreenFormLayout
        title="Edit Flock / Batch"
        backPath="/flocks"
        backLabel="Back to Flocks"
      >
        <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
          Loading flock details...
        </div>
      </FullScreenFormLayout>
    );
  }

  return (
    <FullScreenFormLayout
      title={isEditing ? "Edit Flock / Batch" : "New Flock / Batch"}
      subtitle={
        isEditing
          ? "Update batch parameters, status, target weight, or notes."
          : "Register a biological bird batch for growth tracking and performance analysis."
      }
      backPath="/flocks"
      backLabel="Back to Flocks"
    >
      {error && <div className="form-error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="houseId">Poultry House</label>
            <select
              id="houseId"
              name="houseId"
              value={formData.houseId}
              onChange={handleChange}
              disabled={isEditing}
            >
              {houses.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name} ({h.birdsPlaced} capacity)
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="breedId">Bird Breed (Optional)</label>
            <select
              id="breedId"
              name="breedId"
              value={formData.breedId}
              onChange={handleChange}
            >
              <option value="">-- No specific breed --</option>
              {breeds.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.numberOfBirds} cataloged)
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="name">
              Flock / Batch Name <span style={{ color: "var(--alert-danger)" }}>*</span>
            </label>
            <input
              id="name"
              name="name"
              type="text"
              placeholder="e.g. Batch 2026-03 Broilers"
              value={formData.name}
              onChange={handleChange}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="batchNumber">Batch Identifier #</label>
            <input
              id="batchNumber"
              name="batchNumber"
              type="text"
              placeholder="e.g. B26-03"
              value={formData.batchNumber}
              onChange={handleChange}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="purpose">Flock Purpose / Type</label>
            <select
              id="purpose"
              name="purpose"
              value={formData.purpose}
              onChange={handleChange}
            >
              <option value="BROILER">Broiler (Meat Production)</option>
              <option value="LAYER">Layer (Egg Production)</option>
              <option value="BREEDER">Breeder (Reproduction)</option>
              <option value="DUAL_PURPOSE">Dual Purpose (Meat & Eggs)</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="birdsPlaced">
              Birds Placed <span style={{ color: "var(--alert-danger)" }}>*</span>
            </label>
            <input
              id="birdsPlaced"
              name="birdsPlaced"
              type="number"
              min="1"
              step="1"
              placeholder="e.g. 500"
              value={formData.birdsPlaced}
              onChange={handleChange}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="placementDate">
              Placement / Hatch Date <span style={{ color: "var(--alert-danger)" }}>*</span>
            </label>
            <input
              id="placementDate"
              name="placementDate"
              type="date"
              value={formData.placementDate}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label htmlFor="expectedMarketDate">Expected Market / Harvest Date</label>
            <input
              id="expectedMarketDate"
              name="expectedMarketDate"
              type="date"
              value={formData.expectedMarketDate}
              onChange={handleChange}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="targetWeightKg">Target Live Weight (kg)</label>
            <input
              id="targetWeightKg"
              name="targetWeightKg"
              type="number"
              min="0.1"
              step="0.05"
              placeholder="e.g. 2.2"
              value={formData.targetWeightKg}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label htmlFor="status">Batch Lifecycle Status</label>
            <select
              id="status"
              name="status"
              value={formData.status}
              onChange={handleChange}
            >
              <option value="ACTIVE">Active (Currently in house)</option>
              <option value="COMPLETED">Completed (Production finished)</option>
              <option value="SOLD">Sold (Marketed)</option>
              <option value="SLAUGHTERED">Slaughtered / Harvested</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="notes">Flock Notes / Source Hatchery</label>
          <textarea
            id="notes"
            name="notes"
            rows="3"
            placeholder="e.g. Sourced from Banjul Hatchery, vaccinated on Day 1 for ND."
            value={formData.notes}
            onChange={handleChange}
          />
        </div>

        <div className="form-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() => navigate("/flocks")}
            disabled={saving}
          >
            Cancel
          </button>

          <button
            type="submit"
            className="primary-button"
            disabled={saving}
          >
            {saving ? "Saving Batch..." : isEditing ? "Update Batch" : "Create Flock / Batch"}
          </button>
        </div>
      </form>
    </FullScreenFormLayout>
  );
}

export default FlockFormPage;
