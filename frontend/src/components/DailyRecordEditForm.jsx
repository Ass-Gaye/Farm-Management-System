import { useState, useEffect } from "react";
import { useFarm } from "../context/useFarm";
import { updateDailyRecord, getFeedTypes } from "../services/api";

function DailyRecordEditForm({ record, onSuccess, onCancel }) {
  const { flocks } = useFarm();

  const [formData, setFormData] = useState({
    flockId: record.flockId ? String(record.flockId) : "",
    date: new Date(record.date).toISOString().split("T")[0],
    mortality: record.mortality,
    feedUsedKg: record.feedUsedKg,
    eggsCollected: record.eggsCollected,
    avgWeightGrams: record.avgWeightGrams ? String(record.avgWeightGrams) : "",
    feedTypeId: record.feedTypeId ? String(record.feedTypeId) : "",
  });

  const [feedTypes, setFeedTypes] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;
    getFeedTypes()
      .then((res) => {
        if (isMounted && res.data) {
          setFeedTypes(res.data);
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
        let restoredStock = Number(selectedFeed.currentStock || 0);
        let requiredInFeedUnit = Number(formData.feedUsedKg);

        if (fUnit === "bags") {
          const bagWeight = Number(selectedFeed.bagWeightKg);
          if (!bagWeight || bagWeight <= 0) {
            setError(`Feed type '${selectedFeed.name}' does not have a valid bag weight configured for conversion.`);
            return;
          }
          if (String(record.feedTypeId) === String(formData.feedTypeId) && Number(record.feedUsedKg) > 0) {
            restoredStock += Number(record.feedUsedKg) / bagWeight;
          }
          requiredInFeedUnit = Number(formData.feedUsedKg) / bagWeight;
        } else if (fUnit === "kg") {
          if (String(record.feedTypeId) === String(formData.feedTypeId) && Number(record.feedUsedKg) > 0) {
            restoredStock += Number(record.feedUsedKg);
          }
        } else {
          setError(`Unsupported feed unit '${selectedFeed.unit}'. Supported units are 'kg' and 'bags'.`);
          return;
        }

        if (restoredStock < requiredInFeedUnit) {
          setError(
            `Insufficient feed stock. Available: ${restoredStock} ${selectedFeed.unit}, required: ${requiredInFeedUnit} ${selectedFeed.unit}.`
          );
          return;
        }
      }
    }

    try {
        setSaving(true);

        const result = await updateDailyRecord(record.id, {
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
        <div className="form-row">
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

          <div className="form-group">
            <label htmlFor="edit-record-flock">Flock / Batch (Optional)</label>
            <select
              id="edit-record-flock"
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

        {feedTypes.length > 0 && (
          <div className="form-group">
            <label htmlFor="edit-record-feedType">Feed Variety (Deducts from Inventory)</label>
            <select
              id="edit-record-feedType"
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

          <div className="form-group">
            <label htmlFor="edit-record-weight">Avg Bird Weight (g) (For FCR)</label>
            <input
              id="edit-record-weight"
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
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default DailyRecordEditForm;