import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useFarm } from "../context/useFarm";
import FullScreenFormLayout from "../components/common/FullScreenFormLayout";
import {
  createDailyRecord,
  updateDailyRecord,
  getDailyRecordById,
} from "../services/api";

function DailyRecordFormPage() {
  const { id } = useParams();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const { selectedHouse, records, reloadHouseData, showToast } = useFarm();

  const existingRecord = isEditing
    ? records.find((r) => r.id === Number(id))
    : null;

  const [formData, setFormData] = useState(() => {
    if (existingRecord) {
      return {
        date: new Date(existingRecord.date).toISOString().split("T")[0],
        mortality: String(existingRecord.mortality),
        feedUsedKg: String(existingRecord.feedUsedKg),
        eggsCollected: String(existingRecord.eggsCollected),
      };
    }
    return {
      date: new Date().toISOString().split("T")[0],
      mortality: "",
      feedUsedKg: "",
      eggsCollected: "",
    };
  });

  const [loadingRecord, setLoadingRecord] = useState(
    Boolean(isEditing && !existingRecord)
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEditing || existingRecord) return;

    let cancelled = false;
    const fetchRecord = async () => {
      try {
        const result = await getDailyRecordById(id);
        if (!cancelled && result.data) {
          setFormData({
            date: new Date(result.data.date).toISOString().split("T")[0],
            mortality: String(result.data.mortality),
            feedUsedKg: String(result.data.feedUsedKg),
            eggsCollected: String(result.data.eggsCollected),
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
      setError("Please fill in all required fields.");
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

    if (!selectedHouse?.id) {
      setError("No poultry house selected.");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        houseId: selectedHouse.id,
        date: formData.date,
        mortality: mortalityNum,
        feedUsedKg: feedNum,
        eggsCollected: eggsNum,
      };

      if (isEditing) {
        await updateDailyRecord(id, {
          date: formData.date,
          mortality: mortalityNum,
          feedUsedKg: feedNum,
          eggsCollected: eggsNum,
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
