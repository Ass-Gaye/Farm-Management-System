import { useState } from "react";

import { updateDailyRecord } from "../services/api";

function DailyRecordEditForm({ record, onSuccess, onCancel }) {
  const [formData, setFormData] = useState({
    date: new Date(record.date).toISOString().split("T")[0],
    mortality: record.mortality,
    feedUsedKg: record.feedUsedKg,
    eggsCollected: record.eggsCollected,
  });

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

 const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");

    if (
        formData.mortality === "" ||
        formData.feedUsedKg === "" ||
        formData.eggsCollected === ""
    ) {
        setError("Please fill in all fields.");
        return;
    }

    try {
        setSaving(true);

        const result = await updateDailyRecord(record.id, {
        date: formData.date,
        mortality: Number(formData.mortality),
        feedUsedKg: Number(formData.feedUsedKg),
        eggsCollected: Number(formData.eggsCollected),
        });

        onSuccess(result.data);
    } catch (err) {
        setError(err.message);
    } finally {
        setSaving(false);
    }
 };

  return (
    <div className="form-card">
      <div className="form-header">
        <div>
          <h2>Edit Daily Record</h2>
          <p>Update the selected daily record.</p>
        </div>

        <button
          type="button"
          className="close-button"
          onClick={onCancel}
        >
          ×
        </button>
      </div>

      {error && <div className="form-error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="edit-record-date">Date</label>

          <input
            id="edit-record-date"
            name="date"
            type="date"
            value={formData.date}
            onChange={handleChange}
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="edit-record-mortality">
              Mortality
            </label>

            <input
              id="edit-record-mortality"
              name="mortality"
              type="number"
              min="0"
              step="1"
              value={formData.mortality}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label htmlFor="edit-record-feed">
              Feed Used (kg)
            </label>

            <input
              id="edit-record-feed"
              name="feedUsedKg"
              type="number"
              min="0"
              step="0.1"
              value={formData.feedUsedKg}
              onChange={handleChange}
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="edit-record-eggs">
            Eggs Collected
          </label>

          <input
            id="edit-record-eggs"
            name="eggsCollected"
            type="number"
            min="0"
            step="1"
            value={formData.eggsCollected}
            onChange={handleChange}
          />
        </div>

        <div className="form-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={onCancel}
          >
            Cancel
          </button>

          <button
            type="submit"
            className="primary-button"
            disabled={saving}
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default DailyRecordEditForm;