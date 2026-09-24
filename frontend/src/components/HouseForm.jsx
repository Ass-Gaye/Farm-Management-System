import { useState } from "react";

import { createHouse } from "../services/api";

function HouseForm({ onSuccess, onCancel }) {
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    birdsPlaced: "",
    createdAt: new Date().toISOString().split("T")[0],
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

        if (!formData.name.trim()) {
            setError("House name is required.");
            return;
        }

        if (!formData.address.trim()) {
            setError("Address / Location is required.");
            return;
        }

        if (!formData.birdsPlaced || Number(formData.birdsPlaced) <= 0) {
            setError("Number of birds must be greater than 0.");
            return;
        }

        try {
            setSaving(true);

            const result = await createHouse({
            name: formData.name.trim(),
            address: formData.address.trim(),
            birdsPlaced: Number(formData.birdsPlaced),
            createdAt: formData.createdAt,
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
          <h2>Add Poultry House</h2>
          <p>Create a new poultry house.</p>
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
          <label htmlFor="house-name">House Name</label>

          <input
            id="house-name"
            name="name"
            type="text"
            placeholder="e.g. Sunrise Poultry House"
            value={formData.name}
            onChange={handleChange}
          />
        </div>

        <div className="form-group">
          <label htmlFor="house-address">Address / Location</label>

          <input
            id="house-address"
            name="address"
            type="text"
            placeholder="e.g. Brufut, West Coast Region"
            value={formData.address}
            onChange={handleChange}
          />
        </div>

        <div className="form-group">
          <label htmlFor="birds-placed">Birds Placed</label>

          <input
            id="birds-placed"
            name="birdsPlaced"
            type="number"
            min="1"
            step="1"
            placeholder="e.g. 500"
            value={formData.birdsPlaced}
            onChange={handleChange}
          />
        </div>

        <div className="form-group">
          <label htmlFor="created-at">Date Created</label>

          <input
            id="created-at"
            name="createdAt"
            type="date"
            value={formData.createdAt}
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
            {saving ? "Creating..." : "Create House"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default HouseForm;