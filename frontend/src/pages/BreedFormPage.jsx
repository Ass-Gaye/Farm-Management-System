import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useFarm } from "../context/useFarm";
import FullScreenFormLayout from "../components/common/FullScreenFormLayout";
import { createBreed, updateBreed, getBreedById } from "../services/api";

function BreedFormPage() {
  const { id } = useParams();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const { selectedHouse, breeds, reloadHouseData, showToast } = useFarm();

  const existingBreed = isEditing
    ? breeds.find((b) => b.id === Number(id))
    : null;

  const [formData, setFormData] = useState(() => {
    if (existingBreed) {
      return {
        name: existingBreed.name || "",
        numberOfBirds: String(existingBreed.numberOfBirds || ""),
        dateAdded: existingBreed.dateAdded
          ? new Date(existingBreed.dateAdded).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0],
        description: existingBreed.description || "",
      };
    }
    return {
      name: "",
      numberOfBirds: "",
      dateAdded: new Date().toISOString().split("T")[0],
      description: "",
    };
  });

  const [loadingBreed, setLoadingBreed] = useState(
    Boolean(isEditing && !existingBreed)
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEditing || existingBreed) return;

    let cancelled = false;
    const fetchBreed = async () => {
      try {
        const result = await getBreedById(id);
        if (!cancelled && result.data) {
          setFormData({
            name: result.data.name || "",
            numberOfBirds: String(result.data.numberOfBirds || ""),
            dateAdded: result.data.dateAdded
              ? new Date(result.data.dateAdded).toISOString().split("T")[0]
              : new Date().toISOString().split("T")[0],
            description: result.data.description || "",
          });
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Failed to load breed details.");
        }
      } finally {
        if (!cancelled) {
          setLoadingBreed(false);
        }
      }
    };

    fetchBreed();

    return () => {
      cancelled = true;
    };
  }, [id, isEditing, existingBreed]);

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
    if (
      formData.numberOfBirds === "" ||
      isNaN(birdCount) ||
      birdCount < 0 ||
      !Number.isInteger(birdCount)
    ) {
      setError("Number of birds must be a valid non-negative whole number (0 or greater).");
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
        name: formData.name.trim(),
        numberOfBirds: birdCount,
        description: formData.description.trim() || null,
        dateAdded: formData.dateAdded || new Date().toISOString(),
      };

      if (isEditing) {
        await updateBreed(id, {
          name: payload.name,
          numberOfBirds: payload.numberOfBirds,
          description: payload.description,
          dateAdded: payload.dateAdded,
        });
        showToast(`Breed "${payload.name}" updated successfully.`);
      } else {
        await createBreed(payload);
        showToast(`Breed "${payload.name}" added successfully.`);
      }

      await reloadHouseData();
      navigate("/breeds");
    } catch (err) {
      setError(err.message || "Failed to save breed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <FullScreenFormLayout
      title={isEditing ? "Edit Bird Breed" : "Add Bird Breed"}
      subtitle={
        isEditing
          ? "Update breed details and flock quantity for this poultry house."
          : `Record a new breed kept in ${selectedHouse?.name || "this poultry house"}.`
      }
      backPath="/breeds"
      backLabel="Back to Bird Breeds"
      onCancel={() => navigate("/breeds")}
    >
      {loadingBreed ? (
        <div style={{ textAlign: "center", padding: "40px 0" }}>
          <div className="loading-spinner" style={{ margin: "0 auto 12px" }}></div>
          <p style={{ color: "var(--text-muted)" }}>Loading breed details...</p>
        </div>
      ) : (
        <>
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
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="breed-birds">Number of Birds *</label>
                <input
                  id="breed-birds"
                  name="numberOfBirds"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="e.g. 250"
                  value={formData.numberOfBirds}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="breed-date">Date Added *</label>
                <input
                  id="breed-date"
                  name="dateAdded"
                  type="date"
                  value={formData.dateAdded}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="breed-description">Description / Notes</label>
              <textarea
                id="breed-description"
                name="description"
                rows="3"
                placeholder="e.g. Fast-growing broiler flock intended for 6-week harvest cycle"
                value={formData.description}
                onChange={handleChange}
              ></textarea>
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => navigate("/breeds")}
                disabled={saving}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="primary-button"
                disabled={saving}
              >
                {saving ? "Saving Breed..." : isEditing ? "Save Changes" : "Add Breed"}
              </button>
            </div>
          </form>
        </>
      )}
    </FullScreenFormLayout>
  );
}

export default BreedFormPage;
