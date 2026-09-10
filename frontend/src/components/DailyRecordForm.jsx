import { useState } from "react";

import { createDailyRecord } from "../services/api";

function DailyRecordForm({ houseId, onSuccess, onCancel }) {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    mortality: "",
    feedUsedKg: "",
    eggsCollected: "",
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

        const result = await createDailyRecord({
        houseId: houseId,
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
          <h2>Add Daily Record</h2>
          <p>Enter today's poultry house activity.</p>
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
          <label htmlFor="date">Date</label>

          <input
            id="date"
            name="date"
            type="date"
            value={formData.date}
            onChange={handleChange}
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="mortality">Mortality</label>

            <input
              id="mortality"
              name="mortality"
              type="number"
              min="0"
              step="1"
              placeholder="e.g. 2"
              value={formData.mortality}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label htmlFor="feedUsedKg">Feed Used (kg)</label>

            <input
              id="feedUsedKg"
              name="feedUsedKg"
              type="number"
              min="0"
              step="0.1"
              placeholder="e.g. 10.5"
              value={formData.feedUsedKg}
              onChange={handleChange}
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="eggsCollected">Eggs Collected</label>

          <input
            id="eggsCollected"
            name="eggsCollected"
            type="number"
            min="0"
            step="1"
            placeholder="e.g. 50"
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
            {saving ? "Saving..." : "Save Record"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default DailyRecordForm;