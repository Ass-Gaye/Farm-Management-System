import { useState } from "react";
import { createBreed, updateBreed } from "../services/api";

function BreedForm({ houseId, breed, onSuccess, onCancel }) {
  const isEditing = Boolean(breed);

  const [formData, setFormData] = useState(() => ({
    name: breed?.name || "",
    numberOfBirds: breed?.numberOfBirds ? String(breed.numberOfBirds) : "",
    description: breed?.description || "",
    dateAdded: breed?.dateAdded
      ? new Date(breed.dateAdded).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0],
  }));

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

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
      setError("Breed name is required.");
      return;
    }

    const birdCount = Number(formData.numberOfBirds);
    if (!formData.numberOfBirds || isNaN(birdCount) || birdCount <= 0) {
      setError("Number of birds must be a positive number greater than 0.");
      return;
    }

    try {
      setSaving(true);
      let result;
      if (isEditing) {
        result = await updateBreed(breed.id, {
          name: formData.name.trim(),
          numberOfBirds: birdCount,
          description: formData.description.trim() || null,
          dateAdded: formData.dateAdded,
        });
      } else {
        result = await createBreed({
          houseId,
          name: formData.name.trim(),
          numberOfBirds: birdCount,
          description: formData.description.trim() || null,
          dateAdded: formData.dateAdded,
        });
      }

      onSuccess(result.data);
    } catch (err) {
      setError(err.message || "Failed to save breed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="form-card">
      <div className="form-header">
        <div>
          <h2>{isEditing ? "Edit Bird Breed" : "Add Bird Breed"}</h2>
          <p>
            {isEditing
              ? "Update breed details and flock quantity."
              : "Record a new breed kept in this poultry house."}
          </p>
        </div>
        <button type="button" className="close-button" onClick={onCancel}>
          ×
        </button>
      </div>

      {error && <div className="form-error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="breed-name">Breed Name *</label>
          <input
            id="breed-name"
            name="name"
            type="text"
            placeholder="e.g. Cobb 500, Ross 308, Lohmann Brown"
            value={formData.name}
            onChange={handleChange}
            autoFocus
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="breed-birds">Number of Birds *</label>
            <input
              id="breed-birds"
              name="numberOfBirds"
              type="number"
              min="1"
              step="1"
              placeholder="e.g. 250"
              value={formData.numberOfBirds}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label htmlFor="breed-date">Date Added</label>
            <input
              id="breed-date"
              name="dateAdded"
              type="date"
              value={formData.dateAdded}
              onChange={handleChange}
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="breed-description">Notes & Description</label>
          <textarea
            id="breed-description"
            name="description"
            rows="3"
            placeholder="e.g. Broiler flock intended for 6-week growth cycle"
            value={formData.description}
            onChange={handleChange}
          ></textarea>
        </div>

        <div className="form-actions">
          <button type="button" className="secondary-button" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="primary-button" disabled={saving}>
            {saving
              ? "Saving..."
              : isEditing
              ? "Update Breed"
              : "Add Breed"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default BreedForm;
