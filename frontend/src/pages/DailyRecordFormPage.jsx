import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useFarm } from "../context/useFarm";
import FullScreenFormLayout from "../components/common/FullScreenFormLayout";
import {
  createDailyRecord,
  updateDailyRecord,
  getDailyRecordById,
  getFeedTypes,
} from "../services/api";

function DailyRecordFormPage() {
  const { id } = useParams();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const { selectedHouse, records, flocks, reloadHouseData, showToast } = useFarm();

  const existingRecord = isEditing
    ? records.find((r) => r.id === Number(id))
    : null;

  // Active flocks for this house
  const houseFlocks = flocks || [];
  const defaultFlock = !isEditing && houseFlocks.length === 1 && houseFlocks[0].status === "ACTIVE"
    ? String(houseFlocks[0].id)
    : "";

  const [formData, setFormData] = useState(() => {
    if (existingRecord) {
      return {
        date: new Date(existingRecord.date).toISOString().split("T")[0],
        flockId: existingRecord.flockId ? String(existingRecord.flockId) : "",
        mortality: String(existingRecord.mortality),
        feedUsedKg: String(existingRecord.feedUsedKg),
        eggsCollected: String(existingRecord.eggsCollected),
        avgWeightGrams: existingRecord.avgWeightGrams != null ? String(existingRecord.avgWeightGrams) : "",
        feedTypeId: existingRecord.feedTypeId ? String(existingRecord.feedTypeId) : "",
      };
    }
    return {
      date: new Date().toISOString().split("T")[0],
      flockId: defaultFlock,
      mortality: "",
      feedUsedKg: "",
      eggsCollected: "",
      avgWeightGrams: "",
      feedTypeId: "",
    };
  });

  const [feedTypes, setFeedTypes] = useState([]);
  const [loadingRecord, setLoadingRecord] = useState(
    Boolean(isEditing && !existingRecord)
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Load available feed inventory types
  useEffect(() => {
    let cancelled = false;
    const loadFeeds = async () => {
      try {
        const res = await getFeedTypes();
        if (!cancelled && res?.data) {
          setFeedTypes(res.data.filter((f) => f.active !== false));
        }
      } catch {
        // Non-blocking for daily records
      }
    };
    loadFeeds();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isEditing || existingRecord) return;

    let cancelled = false;
    const fetchRecord = async () => {
      try {
        const result = await getDailyRecordById(id);
        if (!cancelled && result.data) {
          setFormData({
            date: new Date(result.data.date).toISOString().split("T")[0],
            flockId: result.data.flockId ? String(result.data.flockId) : "",
            mortality: String(result.data.mortality),
            feedUsedKg: String(result.data.feedUsedKg),
            eggsCollected: String(result.data.eggsCollected),
            avgWeightGrams: result.data.avgWeightGrams != null ? String(result.data.avgWeightGrams) : "",
            feedTypeId: result.data.feedTypeId ? String(result.data.feedTypeId) : "",
          });
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Failed to load daily record details.");
        }
      } finally {
        if (!cancelled) {
          setLoadingRecord(false);
        }
      }
    };

    fetchRecord();

    return () => {
      cancelled = true;
    };
  }, [id, isEditing, existingRecord]);

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
      formData.eggsCollected === "" ||
      !formData.date
    ) {
      setError("Please fill in all required fields (Date, Mortality, Feed Used, Eggs Collected).");
      return;
    }

    const mortalityNum = Number(formData.mortality);
    const feedNum = Number(formData.feedUsedKg);
    const eggsNum = Number(formData.eggsCollected);

    if (isNaN(mortalityNum) || mortalityNum < 0 || !Number.isInteger(mortalityNum)) {
      setError("Mortality must be a non-negative whole number (0 or greater).");
      return;
    }

    if (isNaN(feedNum) || feedNum < 0) {
      setError("Feed used must be a non-negative number.");
      return;
    }

    if (isNaN(eggsNum) || eggsNum < 0 || !Number.isInteger(eggsNum)) {
      setError("Eggs collected must be a non-negative whole number (0 or greater).");
      return;
    }

    let avgWeightNum = null;
    if (formData.avgWeightGrams !== "") {
      avgWeightNum = Number(formData.avgWeightGrams);
      if (isNaN(avgWeightNum) || avgWeightNum < 0) {
        setError("Average bird weight must be a positive number in grams.");
        return;
      }
    }

    if (!selectedHouse?.id) {
      setError("No poultry house selected.");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        houseId: selectedHouse.id,
        flockId: formData.flockId ? Number(formData.flockId) : null,
        date: formData.date,
        mortality: mortalityNum,
        feedUsedKg: feedNum,
        eggsCollected: eggsNum,
        avgWeightGrams: avgWeightNum,
        feedTypeId: formData.feedTypeId ? Number(formData.feedTypeId) : null,
      };

      if (isEditing) {
        await updateDailyRecord(id, {
          flockId: formData.flockId ? Number(formData.flockId) : null,
          date: formData.date,
          mortality: mortalityNum,
          feedUsedKg: feedNum,
          eggsCollected: eggsNum,
          avgWeightGrams: avgWeightNum,
          feedTypeId: formData.feedTypeId ? Number(formData.feedTypeId) : null,
        });
        showToast("Daily production record updated successfully.");
      } else {
        await createDailyRecord(payload);
        showToast("Daily production record added successfully.");
      }

      await reloadHouseData();
      navigate("/daily-records");
    } catch (err) {
      setError(err.message || "Failed to save daily record.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <FullScreenFormLayout
      title={isEditing ? "Edit Daily Record" : "Add Daily Record"}
      subtitle={
        isEditing
          ? "Update the daily production log for this date."
          : `Enter today's production activity for ${selectedHouse?.name || "the poultry house"}.`
      }
      backPath="/daily-records"
      backLabel="Back to Daily Records"
      onCancel={() => navigate("/daily-records")}
    >
      {loadingRecord ? (
        <div style={{ textAlign: "center", padding: "40px 0" }}>
          <div className="loading-spinner" style={{ margin: "0 auto 12px" }}></div>
          <p style={{ color: "var(--text-muted)" }}>Loading record details...</p>
        </div>
      ) : (
        <>
          {error && <div className="form-error">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="record-date">Date *</label>
                <input
                  id="record-date"
                  name="date"
                  type="date"
                  value={formData.date}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="record-flock">Flock / Batch (Optional)</label>
                <select
                  id="record-flock"
                  name="flockId"
                  value={formData.flockId}
                  onChange={handleChange}
                >
                  <option value="">Whole House (No specific flock)</option>
                  {houseFlocks.map((flock) => (
                    <option key={flock.id} value={flock.id}>
                      {flock.name} ({flock.purpose} · {flock.currentBirds} live birds · {flock.status})
                    </option>
                  ))}
                </select>
                <small style={{ color: "var(--text-muted)", fontSize: "11px", marginTop: "3px", display: "block" }}>
                  Associating with a flock tracks mortality, FCR, and laying rates per batch.
                </small>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="record-mortality">Mortality (Birds) *</label>
                <input
                  id="record-mortality"
                  name="mortality"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="e.g. 2"
                  value={formData.mortality}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="record-eggs">Eggs Collected *</label>
                <input
                  id="record-eggs"
                  name="eggsCollected"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="e.g. 45"
                  value={formData.eggsCollected}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="record-feed">Feed Used in Kilograms (kg) *</label>
                <input
                  id="record-feed"
                  name="feedUsedKg"
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="e.g. 15.5"
                  value={formData.feedUsedKg}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="record-feed-type">Feed Inventory Variety (Optional)</label>
                <select
                  id="record-feed-type"
                  name="feedTypeId"
                  value={formData.feedTypeId}
                  onChange={handleChange}
                >
                  <option value="">None / Manual Log Only</option>
                  {feedTypes.map((feed) => (
                    <option key={feed.id} value={feed.id}>
                      {feed.name} ({Number(feed.currentStock)} {feed.unit} in stock)
                    </option>
                  ))}
                </select>
                <small style={{ color: "var(--text-muted)", fontSize: "11px", marginTop: "3px", display: "block" }}>
                  Automatically deducts consumed feed from inventory stock.
                </small>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="record-avg-weight">Average Bird Weight in Grams (Optional — For FCR)</label>
              <input
                id="record-avg-weight"
                name="avgWeightGrams"
                type="number"
                min="0"
                step="1"
                placeholder="e.g. 1450"
                value={formData.avgWeightGrams}
                onChange={handleChange}
              />
              <small style={{ color: "var(--text-muted)", fontSize: "11px", marginTop: "3px", display: "block" }}>
                Weigh a sample of birds and record their average weight in grams to calculate Feed Conversion Ratio (FCR).
              </small>
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => navigate("/daily-records")}
                disabled={saving}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="primary-button"
                disabled={saving}
              >
                {saving ? "Saving Record..." : isEditing ? "Save Changes" : "Save Record"}
              </button>
            </div>
          </form>
        </>
      )}
    </FullScreenFormLayout>
  );
}

export default DailyRecordFormPage;
