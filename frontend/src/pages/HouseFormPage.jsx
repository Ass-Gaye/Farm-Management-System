import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useFarm } from "../context/useFarm";
import FullScreenFormLayout from "../components/common/FullScreenFormLayout";
import { createHouse, updateHouse, getHouseById } from "../services/api";

function HouseFormPage() {
  const { id } = useParams();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const { houses, selectedHouse, loadHouses, showToast } = useFarm();

  const existingHouse = isEditing
    ? houses.find((h) => h.id === Number(id)) ||
      (selectedHouse?.id === Number(id) ? selectedHouse : null)
    : null;

  const [formData, setFormData] = useState(() => {
    if (existingHouse) {
      return {
        name: existingHouse.name || "",
        address: existingHouse.address || "",
        birdsPlaced: String(existingHouse.birdsPlaced || ""),
        createdAt: existingHouse.createdAt
          ? new Date(existingHouse.createdAt).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0],
      };
    }
    return {
      name: "",
      address: "",
      birdsPlaced: "",
      createdAt: new Date().toISOString().split("T")[0],
    };
  });

  const [loadingHouse, setLoadingHouse] = useState(
    Boolean(isEditing && !existingHouse)
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEditing || existingHouse) return;

    let cancelled = false;
    const fetchHouse = async () => {
      try {
        const result = await getHouseById(id);
        if (!cancelled && result.data) {
          setFormData({
            name: result.data.name || "",
            address: result.data.address || "",
            birdsPlaced: String(result.data.birdsPlaced || ""),
            createdAt: result.data.createdAt
              ? new Date(result.data.createdAt).toISOString().split("T")[0]
              : new Date().toISOString().split("T")[0],
          });
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Failed to load poultry house details.");
        }
      } finally {
        if (!cancelled) {
          setLoadingHouse(false);
        }
      }
    };

    fetchHouse();

    return () => {
      cancelled = true;
    };
  }, [id, isEditing, existingHouse]);

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

    const birdsNum = Number(formData.birdsPlaced);
    if (!formData.birdsPlaced || isNaN(birdsNum) || birdsNum <= 0 || !Number.isInteger(birdsNum)) {
      setError("Number of birds placed must be a whole number greater than 0.");
      return;
    }

    try {
      setSaving(true);

      if (isEditing) {
        const result = await updateHouse(id, {
          name: formData.name.trim(),
          address: formData.address.trim(),
          birdsPlaced: birdsNum,
        });
        showToast(`Poultry house "${result.data.name}" updated.`);
        await loadHouses(Number(id));
      } else {
        const result = await createHouse({
          name: formData.name.trim(),
          address: formData.address.trim(),
          birdsPlaced: birdsNum,
          createdAt: formData.createdAt,
        });
        showToast(`Poultry house "${result.data.name}" created.`);
        await loadHouses(result.data.id);
      }

      navigate("/dashboard");
    } catch (err) {
      setError(err.message || "Failed to save poultry house.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <FullScreenFormLayout
      title={isEditing ? "Edit Poultry House" : "Add Poultry House"}
      subtitle={
        isEditing
          ? "Update poultry house name and initial capacity."
          : "Register a new poultry house or pen in your farm management system."
      }
      backPath="/dashboard"
      backLabel="Back to Dashboard"
      onCancel={() => navigate("/dashboard")}
    >
      {loadingHouse ? (
        <div style={{ textAlign: "center", padding: "40px 0" }}>
          <div className="loading-spinner" style={{ margin: "0 auto 12px" }}></div>
          <p style={{ color: "var(--text-muted)" }}>Loading poultry house details...</p>
        </div>
      ) : (
        <>
          {error && <div className="form-error">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="house-name">House Name *</label>
              <input
                id="house-name"
                name="name"
                type="text"
                placeholder="e.g. Sunrise Broiler House #1"
                value={formData.name}
                onChange={handleChange}
                autoFocus
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="house-address">Address / Location *</label>
              <input
                id="house-address"
                name="address"
                type="text"
                placeholder="e.g. Brufut, West Coast Region"
                value={formData.address}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="birds-placed">Initial Birds Placed *</label>
              <input
                id="birds-placed"
                name="birdsPlaced"
                type="number"
                min="1"
                step="1"
                placeholder="e.g. 500"
                value={formData.birdsPlaced}
                onChange={handleChange}
                required
              />
            </div>

            {!isEditing && (
              <div className="form-group">
                <label htmlFor="created-at">Date Placed / Created *</label>
                <input
                  id="created-at"
                  name="createdAt"
                  type="date"
                  value={formData.createdAt}
                  onChange={handleChange}
                  required
                />
              </div>
            )}

            <div className="form-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => navigate("/dashboard")}
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
                  ? "Saving House..."
                  : isEditing
                  ? "Save Changes"
                  : "Create House"}
              </button>
            </div>
          </form>
        </>
      )}
    </FullScreenFormLayout>
  );
}

export default HouseFormPage;
