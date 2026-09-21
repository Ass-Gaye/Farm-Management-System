import { useState, useEffect } from "react";
import { createVaccination, updateVaccination } from "../services/api";

function VaccinationModal({ isOpen, onClose, onSuccess, vaccination, flockId, flocks }) {
  const isEditing = Boolean(vaccination);

  const [formData, setFormData] = useState({
    flockId: flockId ? String(flockId) : "",
    vaccineName: "",
    disease: "",
    targetAgeDays: "",
    scheduledDate: new Date().toISOString().split("T")[0],
    administeredDate: "",
    status: "PENDING",
    dosage: "",
    administeredBy: "",
    cost: "",
    notes: "",
  });

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (vaccination) {
      setFormData({
        flockId: String(vaccination.flockId),
        vaccineName: vaccination.vaccineName || "",
        disease: vaccination.disease || "",
        targetAgeDays: vaccination.targetAgeDays !== null ? String(vaccination.targetAgeDays) : "",
        scheduledDate: vaccination.scheduledDate
          ? new Date(vaccination.scheduledDate).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0],
        administeredDate: vaccination.administeredDate
          ? new Date(vaccination.administeredDate).toISOString().split("T")[0]
          : "",
        status: vaccination.status || "PENDING",
        dosage: vaccination.dosage || "",
        administeredBy: vaccination.administeredBy || "",
        cost: vaccination.cost ? String(vaccination.cost) : "",
        notes: vaccination.notes || "",
      });
    } else {
      setFormData({
        flockId: flockId ? String(flockId) : flocks?.[0]?.id ? String(flocks[0].id) : "",
        vaccineName: "",
        disease: "",
        targetAgeDays: "",
        scheduledDate: new Date().toISOString().split("T")[0],
        administeredDate: "",
        status: "PENDING",
        dosage: "",
        administeredBy: "",
        cost: "",
        notes: "",
      });
    }
    setError("");
  }, [vaccination, flockId, flocks, isOpen]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
      // Auto-set administered date if user changes status to COMPLETED and administeredDate is empty
      ...(name === "status" && value === "COMPLETED" && !prev.administeredDate
        ? { administeredDate: new Date().toISOString().split("T")[0] }
        : {}),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!formData.flockId) {
      setError("Please select a flock.");
      return;
    }

    if (!formData.vaccineName.trim()) {
      setError("Vaccine name is required.");
      return;
    }

    if (!formData.scheduledDate) {
      setError("Scheduled date is required.");
      return;
    }

    const payload = {
      flockId: Number(formData.flockId),
      vaccineName: formData.vaccineName.trim(),
      disease: formData.disease.trim() || null,
      targetAgeDays: formData.targetAgeDays ? Number(formData.targetAgeDays) : null,
      scheduledDate: new Date(formData.scheduledDate).toISOString(),
      administeredDate: formData.administeredDate
        ? new Date(formData.administeredDate).toISOString()
        : null,
      status: formData.status,
      dosage: formData.dosage.trim() || null,
      administeredBy: formData.administeredBy.trim() || null,
      cost: formData.cost ? Number(formData.cost) : 0,
      notes: formData.notes.trim() || null,
    };

    try {
      setSaving(true);
      if (isEditing) {
        await updateVaccination(vaccination.id, payload);
      } else {
        await createVaccination(payload);
      }
      onSuccess?.();
      onClose?.();
    } catch (err) {
      setError(err.message || "Failed to save vaccination schedule.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div
        className="form-card"
        style={{ maxWidth: 540, width: "90%", margin: "40px auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="form-header">
          <div>
            <h2>{isEditing ? "Edit Vaccination Record" : "Schedule Vaccination"}</h2>
            <p>Administer preventive medications and schedule poultry vaccines.</p>
          </div>
          <button type="button" className="close-button" onClick={onClose}>
            ×
          </button>
        </div>

        {error && <div className="form-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="flockId">Target Flock / Batch</label>
              <select
                id="flockId"
                name="flockId"
                value={formData.flockId}
                onChange={handleChange}
                disabled={isEditing}
              >
                {flocks?.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.purpose} - {f.currentBirds} birds)
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="status">Status</label>
              <select
                id="status"
                name="status"
                value={formData.status}
                onChange={handleChange}
              >
                <option value="PENDING">Pending (Scheduled)</option>
                <option value="COMPLETED">Completed (Administered)</option>
                <option value="MISSED">Missed / Overdue</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="vaccineName">
                Vaccine Name <span style={{ color: "var(--alert-danger)" }}>*</span>
              </label>
              <input
                id="vaccineName"
                name="vaccineName"
                type="text"
                placeholder="e.g. Newcastle Disease (LaSota)"
                value={formData.vaccineName}
                onChange={handleChange}
                autoFocus
              />
            </div>

            <div className="form-group">
              <label htmlFor="disease">Target Disease / Illness</label>
              <input
                id="disease"
                name="disease"
                type="text"
                placeholder="e.g. Newcastle Disease / Ranikhet"
                value={formData.disease}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="scheduledDate">
                Scheduled Date <span style={{ color: "var(--alert-danger)" }}>*</span>
              </label>
              <input
                id="scheduledDate"
                name="scheduledDate"
                type="date"
                value={formData.scheduledDate}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label htmlFor="administeredDate">Date Administered</label>
              <input
                id="administeredDate"
                name="administeredDate"
                type="date"
                value={formData.administeredDate}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="dosage">Dosage & Method</label>
              <input
                id="dosage"
                name="dosage"
                type="text"
                placeholder="e.g. 1 drop eye / drinking water"
                value={formData.dosage}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label htmlFor="targetAgeDays">Target Age (Days Old)</label>
              <input
                id="targetAgeDays"
                name="targetAgeDays"
                type="number"
                min="1"
                placeholder="e.g. 7"
                value={formData.targetAgeDays}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="administeredBy">Administered By</label>
              <input
                id="administeredBy"
                name="administeredBy"
                type="text"
                placeholder="e.g. Farm Manager / Vet"
                value={formData.administeredBy}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label htmlFor="cost">Total Cost (GMD)</label>
              <input
                id="cost"
                name="cost"
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g. 250"
                value={formData.cost}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="notes">Notes / Observations</label>
            <textarea
              id="notes"
              name="notes"
              rows="2"
              placeholder="e.g. Batch # or withdrawal period notes..."
              value={formData.notes}
              onChange={handleChange}
            />
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="primary-button"
              disabled={saving}
            >
              {saving ? "Saving..." : isEditing ? "Update Record" : "Save Vaccination"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default VaccinationModal;
