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
  const { selectedHouse, records, flocks, reloadHouseData, notifyFeedInventoryChanged, notifyEggInventoryChanged, showToast } = useFarm();

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
  const [scope, setScope] = useState(() =>
    existingRecord?.flockId || (!isEditing && defaultFlock) ? "FLOCK" : "HOUSE"
  );
  const [successSummary, setSuccessSummary] = useState(null);
  const selectedFeed = feedTypes.find((f) => String(f.id) === String(formData.feedTypeId));
  const feedUsedNum = Number(formData.feedUsedKg);
  let consumptionPreview = null;
  if (selectedFeed && !isNaN(feedUsedNum) && feedUsedNum > 0) {
    const bagWeight = Number(selectedFeed.bagWeightKg);
    const fUnit = (selectedFeed.unit || "kg").toLowerCase();
    if (fUnit.includes("bag") && bagWeight > 0) {
      consumptionPreview = feedUsedNum / bagWeight;
    } else if (fUnit.includes("kg")) {
      consumptionPreview = feedUsedNum;
    }
  }
  const insufficientPreview =
    selectedFeed &&
    consumptionPreview !== null &&
    Number(selectedFeed.currentStock) < consumptionPreview;
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

  const handleScopeChange = (nextScope) => {
    setScope(nextScope);
    if (nextScope === "HOUSE") {
      setFormData((previous) => ({ ...previous, flockId: "" }));
    }
  };

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

    if (scope === "FLOCK" && !formData.flockId) {
      setError("Please select a flock for this flock-level record, or choose Entire House.");
      return;
    }

    if (insufficientPreview) {
      setError(
        `Not enough ${selectedFeed.name} available (have ${Number(selectedFeed.currentStock)} ${selectedFeed.unit}, entered ${consumptionPreview} ${selectedFeed.unit}). Reduce the quantity or record a feed purchase first.`
      );
      return;
    }

    try {
      setSaving(true);

      const payload = {
        houseId: selectedHouse.id,
        flockId: scope === "FLOCK" && formData.flockId ? Number(formData.flockId) : null,
        date: formData.date,
        mortality: mortalityNum,
        feedUsedKg: feedNum,
        eggsCollected: eggsNum,
        avgWeightGrams: avgWeightNum,
        feedTypeId: formData.feedTypeId ? Number(formData.feedTypeId) : null,
      };

      let result;
      if (isEditing) {
        result = await updateDailyRecord(id, {
          flockId: scope === "FLOCK" && formData.flockId ? Number(formData.flockId) : null,
          date: formData.date,
          mortality: mortalityNum,
          feedUsedKg: feedNum,
          eggsCollected: eggsNum,
          avgWeightGrams: avgWeightNum,
          feedTypeId: formData.feedTypeId ? Number(formData.feedTypeId) : null,
        });
        showToast("Daily production record updated successfully.");
      } else {
        result = await createDailyRecord(payload);
        showToast("Daily production record added successfully.");
      }

      await reloadHouseData();
      notifyFeedInventoryChanged();
      if (notifyEggInventoryChanged) notifyEggInventoryChanged();
      const savedFlock = scope === "FLOCK"
        ? houseFlocks.find((f) => String(f.id) === String(formData.flockId))
        : null;
      setSuccessSummary({
        date: formData.date,
        houseName: selectedHouse.name,
        scope,
        flockName: savedFlock?.name || null,
        mortality: mortalityNum,
        eggsCollected: eggsNum,
        inventory: result?.inventory || null,
        eggInventory: result?.eggInventory || null,
        feedUsedKg: feedNum,
      });
    } catch (err) {
      setError(err.message || "Failed to save daily record.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddAnother = () => {
    setFormData({
      date: new Date().toISOString().split("T")[0],
      flockId: "",
      mortality: "",
      feedUsedKg: "",
      eggsCollected: "",
      avgWeightGrams: "",
      feedTypeId: "",
    });
    setScope("HOUSE");
    setSuccessSummary(null);
    setError("");
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
      ) : successSummary ? (
        <div>
          <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 8, background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>✓ Daily Record Saved</div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              {successSummary.houseName}
              {successSummary.scope === "FLOCK" && successSummary.flockName ? ` · ${successSummary.flockName}` : " · Entire House"}
              {" · "}{new Date(`${successSummary.date}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}
            </div>
          </div>

          <div style={{ display: "grid", gap: 8, fontSize: 13, marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--text-secondary)" }}>Mortality</span>
              <strong>{successSummary.mortality} birds</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--text-secondary)" }}>Eggs collected</span>
              <strong>{successSummary.eggsCollected}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--text-secondary)" }}>Feed consumed</span>
              <strong>{successSummary.feedUsedKg} kg</strong>
            </div>
          </div>

          {successSummary.inventory ? (
            <div style={{ padding: "12px 14px", borderRadius: 8, marginBottom: 16, fontSize: 13, background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Feed Stock</div>
              <div style={{ fontSize: 14, marginBottom: 4 }}>
                <strong>{successSummary.inventory.feedName}</strong>
              </div>
              <div>
                {successSummary.inventory.stockBefore} → {successSummary.inventory.stockAfter} {successSummary.inventory.unit}
              </div>
              <div style={{ marginTop: 6, fontSize: 12, color: "#166534" }}>
                ✓ {successSummary.inventory.feedUsedKg} kg automatically deducted from shared stock
              </div>
            </div>
          ) : (
            <div style={{ padding: "10px 12px", borderRadius: 8, marginBottom: 16, fontSize: 12, color: "var(--text-muted)", background: "#f8fafc", border: "1px solid #e2e8f0" }}>
              No feed type was linked, so no stock was deducted.
            </div>
          )}

          {successSummary.eggInventory ? (
            <div style={{ padding: "12px 14px", borderRadius: 8, marginBottom: 16, fontSize: 13, background: "#fefce8", border: "1px solid #fde68a" }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>🥚 Egg Stock</div>
              <div>
                {successSummary.eggInventory.stockBefore} → {successSummary.eggInventory.stockAfter} eggs
              </div>
              <div style={{ marginTop: 6, fontSize: 12, color: "#92400e" }}>
                ✓ {successSummary.eggInventory.collectedEggs} eggs automatically added to egg stock
              </div>
            </div>
          ) : null}

          <div className="form-actions">
            {!isEditing && (
              <button type="button" className="secondary-button" onClick={handleAddAnother}>
                Add Another Record
              </button>
            )}
            <button type="button" className="primary-button" onClick={() => navigate("/daily-records")}>
              Back to Daily Records
            </button>
          </div>
        </div>
      ) : (
        <>
          {error && <div className="form-error">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="record-house">Poultry House *</label>
              <input
                id="record-house"
                type="text"
                value={selectedHouse?.name || "No house selected"}
                disabled
                readOnly
              />
              <small style={{ color: "var(--text-muted)", fontSize: "11px", marginTop: "3px", display: "block" }}>
                Daily record will be saved for this house. Switch houses from the dashboard to record elsewhere.
              </small>
            </div>

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
                <label>Where does this record apply? *</label>
                <div style={{ display: "flex", gap: "8px" }} role="group" aria-label="Record scope">
                  <button
                    type="button"
                    className={scope === "HOUSE" ? "primary-button" : "secondary-button"}
                    onClick={() => handleScopeChange("HOUSE")}
                    style={{ flex: 1 }}
                  >
                    Entire House
                  </button>
                  <button
                    type="button"
                    className={scope === "FLOCK" ? "primary-button" : "secondary-button"}
                    onClick={() => handleScopeChange("FLOCK")}
                    style={{ flex: 1 }}
                  >
                    Specific Flock
                  </button>
                </div>
                {scope === "HOUSE" ? (
                  <small style={{ color: "var(--text-muted)", fontSize: "11px", marginTop: "3px", display: "block" }}>
                    House-level record — applies to the whole house (flockId: null).
                  </small>
                ) : (
                  <>
                    <select
                      id="record-flock"
                      name="flockId"
                      value={formData.flockId}
                      onChange={handleChange}
                      required
                      style={{ marginTop: "8px" }}
                    >
                      <option value="">Select a flock in {selectedHouse?.name || "this house"}…</option>
                      {houseFlocks.map((flock) => (
                        <option key={flock.id} value={flock.id}>
                          {flock.name} ({flock.purpose} · {flock.currentBirds} live birds · {flock.status})
                        </option>
                      ))}
                    </select>
                    <small style={{ color: "var(--text-muted)", fontSize: "11px", marginTop: "3px", display: "block" }}>
                      Flock-level record — the flock must belong to the selected house. Tracks mortality, FCR, and laying rates per batch.
                    </small>
                  </>
                )}
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
                  placeholder="e.g. 120"
                  value={formData.eggsCollected}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="record-feed-type">Feed Type *</label>
                <select
                  id="record-feed-type"
                  name="feedTypeId"
                  value={formData.feedTypeId}
                  onChange={handleChange}
                >
                  <option value="">Select feed type (e.g. Broiler Starter)</option>
                  {feedTypes.map((feed) => (
                    <option key={feed.id} value={feed.id}>
                      {feed.name} ({Number(feed.currentStock)} {feed.unit} in stock)
                    </option>
                  ))}
                </select>
                <small style={{ color: "var(--text-muted)", fontSize: "11px", marginTop: "3px", display: "block" }}>
                  The consumed amount is deducted ONLY from this feed&apos;s inventory.
                </small>
              </div>

              <div className="form-group">
                <label htmlFor="record-feed">Feed Used (kg) *</label>
                <input
                  id="record-feed"
                  name="feedUsedKg"
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="e.g. 25"
                  value={formData.feedUsedKg}
                  onChange={handleChange}
                  required
                />
                <small style={{ color: "var(--text-muted)", fontSize: "11px", marginTop: "3px", display: "block" }}>
                  Enter kilograms used today (e.g. 25 kg).
                </small>
              </div>
            </div>

            {selectedFeed && consumptionPreview !== null && (
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: 8,
                  marginBottom: 16,
                  fontSize: 13,
                  background: insufficientPreview ? "#fef2f2" : "#f8fafc",
                  border: `1px solid ${insufficientPreview ? "#fecaca" : "#e2e8f0"}`,
                  color: insufficientPreview ? "#991b1b" : "inherit",
                }}
                aria-live="polite"
              >
                {insufficientPreview ? (
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>⚠ Not enough feed available</div>
                    <div>Available: {Number(selectedFeed.currentStock)} {selectedFeed.unit}</div>
                    <div>Entered: {consumptionPreview} {selectedFeed.unit} ({feedUsedNum} kg)</div>
                    <div style={{ marginTop: 6, fontSize: 12 }}>
                      Reduce the quantity or record a feed purchase first.
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
                      <span style={{ color: "var(--text-secondary)" }}>Available now ({selectedFeed.name})</span>
                      <strong>{Number(selectedFeed.currentStock)} {selectedFeed.unit}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
                      <span style={{ color: "var(--text-secondary)" }}>This entry</span>
                      <strong style={{ color: "#dc2626" }}>-{consumptionPreview} {selectedFeed.unit} ({feedUsedNum} kg)</strong>
                    </div>
                    <div style={{ borderTop: "1px solid #e2e8f0", margin: "6px 0" }} />
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
                      <span style={{ color: "var(--text-secondary)" }}>Remaining after save</span>
                      <strong style={{ color: "#166534" }}>
                        {(Number(selectedFeed.currentStock) - consumptionPreview).toFixed(2)} {selectedFeed.unit}
                      </strong>
                    </div>
                    <div style={{ marginTop: 6, fontSize: 11, color: "var(--text-muted)" }}>
                      Shared farm stock — deducted automatically on save. No manual adjustment needed.
                    </div>
                  </div>
                )}
              </div>
            )}

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
                disabled={saving || insufficientPreview}
                title={insufficientPreview ? "Not enough feed available — reduce the quantity first" : undefined}
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
