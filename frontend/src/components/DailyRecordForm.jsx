import { useState, useEffect } from "react";
import { useFarm } from "../context/useFarm";
import { createDailyRecord, getFeedTypes } from "../services/api";

function DailyRecordForm({ houseId, onSuccess, onCancel }) {
  const { flocks } = useFarm();
  const activeFlocks = flocks?.filter((f) => f.status === "ACTIVE") || [];

  const [formData, setFormData] = useState({
    flockId: activeFlocks?.[0]?.id ? String(activeFlocks[0].id) : "",
    date: new Date().toISOString().split("T")[0],
    mortality: "",
    feedUsedKg: "",
    eggsCollected: "",
    avgWeightGrams: "",
    feedTypeId: "",
  });

  const [feedTypes, setFeedTypes] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;
    getFeedTypes({ active: true })
      .then((res) => {
        if (isMounted && res.data) {
          setFeedTypes(res.data);
          if (res.data.length > 0) {
            setFormData((prev) => ({ ...prev, feedTypeId: String(res.data[0].id) }));
          }
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

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

    if (formData.feedTypeId && Number(formData.feedUsedKg) > 0) {
      const selectedFeed = feedTypes.find((ft) => String(ft.id) === String(formData.feedTypeId));
      if (selectedFeed) {
        const fUnit = (selectedFeed.unit || "kg").trim().toLowerCase();
        const currentStock = Number(selectedFeed.currentStock || 0);
        let requiredInFeedUnit = Number(formData.feedUsedKg);

        if (fUnit === "bags") {
          const bagWeight = Number(selectedFeed.bagWeightKg);
          if (!bagWeight || bagWeight <= 0) {
            setError(`Feed type '${selectedFeed.name}' does not have a valid bag weight configured for conversion.`);
            return;
          }
          requiredInFeedUnit = Number(formData.feedUsedKg) / bagWeight;
        } else if (fUnit !== "kg") {
          setError(`Unsupported feed unit '${selectedFeed.unit}'. Supported units are 'kg' and 'bags'.`);
          return;
        }

        if (currentStock < requiredInFeedUnit) {
          setError(
            `Insufficient feed stock. Available: ${currentStock} ${selectedFeed.unit}, required: ${requiredInFeedUnit} ${selectedFeed.unit}.`
          );
          return;
        }
      }
    }

    try {
        setSaving(true);

        const result = await createDailyRecord({
          houseId: houseId,
          flockId: formData.flockId ? Number(formData.flockId) : null,
          date: formData.date,
          mortality: Number(formData.mortality),
          feedUsedKg: Number(formData.feedUsedKg),
          eggsCollected: Number(formData.eggsCollected),
          avgWeightGrams: formData.avgWeightGrams ? Number(formData.avgWeightGrams) : null,
          feedTypeId: formData.feedTypeId ? Number(formData.feedTypeId) : null,
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
        <div className="form-row">
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

          <div className="form-group">
            <label htmlFor="flockId">Flock / Batch (Optional)</label>
            <select
              id="flockId"
              name="flockId"
              value={formData.flockId}
              onChange={handleChange}
            >
              <option value="">-- Whole House / No Batch --</option>
              {flocks?.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} ({f.purpose} - {f.currentBirds} live)
                </option>
              ))}
            </select>
          </div>
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

        {feedTypes.length > 0 && (
          <div className="form-group">
            <label htmlFor="feedTypeId">Feed Variety (Deducts from Inventory)</label>
            <select
              id="feedTypeId"
              name="feedTypeId"
              value={formData.feedTypeId}
              onChange={handleChange}
            >
              <option value="">-- Do Not Track / Untracked --</option>
              {feedTypes.map((ft) => (
                <option key={ft.id} value={ft.id}>
                  {ft.name} ({ft.currentStock} {ft.unit} in stock{ft.isLowStock ? " - LOW" : ""})
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="form-row">
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

          <div className="form-group">
            <label htmlFor="avgWeightGrams">Avg Bird Weight (g) (For FCR)</label>
            <input
              id="avgWeightGrams"
              name="avgWeightGrams"
              type="number"
              min="0"
              step="1"
              placeholder="e.g. 1850"
              value={formData.avgWeightGrams}
              onChange={handleChange}
            />
          </div>
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