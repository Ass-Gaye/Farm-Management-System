import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFarm } from "../context/useFarm";
import PageHeader from "../components/common/PageHeader";
import EmptyState from "../components/common/EmptyState";
import CorrectionModal from "../components/CorrectionModal";
import { isOutsideWindow } from "../utils/correctionWindow";
import { PlusIcon } from "../components/Icons";

import { exportToCsv } from "../utils/exportCsv";

function DailyRecordsPage() {
  const navigate = useNavigate();
  const { records, flocks, selectedHouse, setConfirmDialog, reloadHouseData, notifyFeedInventoryChanged, showToast } = useFarm();

  const [dateFilter, setDateFilter] = useState("");
  const [flockFilter, setFlockFilter] = useState("ALL");
  const [sortOrder, setSortOrder] = useState("newest"); // "newest" | "oldest"
  const [correctingRecord, setCorrectingRecord] = useState(null);

  const handleCorrectionSaved = async () => {
    setCorrectingRecord(null);
    await reloadHouseData();
    if (notifyFeedInventoryChanged) notifyFeedInventoryChanged();
    showToast("Correction recorded. Original entry unchanged.");
  };

  const filteredAndSortedRecords = [...records]
    .filter((record) => {
      if (dateFilter && (!record.date || !record.date.includes(dateFilter))) return false;
      if (flockFilter !== "ALL") {
        if (flockFilter === "NONE") {
          if (record.flockId) return false;
        } else if (String(record.flockId) !== String(flockFilter)) {
          return false;
        }
      }
      return true;
    })
    .sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
    });

  const totalFilteredMortality = filteredAndSortedRecords.reduce(
    (sum, r) => sum + (r.correctedMortality ?? r.mortality ?? 0),
    0
  );
  const totalFilteredFeed = filteredAndSortedRecords.reduce(
    (sum, r) => sum + (Number(r.feedUsedKg) || 0),
    0
  );
  const totalFilteredEggs = filteredAndSortedRecords.reduce(
    (sum, r) => sum + (r.correctedEggs ?? r.eggsCollected ?? 0),
    0
  );

  const handleExportCsv = () => {
    const headers = [
      "Date",
      "House",
      "Flock / Batch",
      "Mortality",
      "Feed Used (kg)",
      "Feed Variety",
      "Eggs Collected",
      "Avg Bird Weight (g)",
    ];

    const rows = filteredAndSortedRecords.map((r) => [
      new Date(r.date).toISOString().split("T")[0],
      r.house?.name || selectedHouse?.name || "",
      r.flock?.name || "Whole House",
      r.mortality ?? 0,
      r.feedUsedKg ?? 0,
      r.feedType?.name || "",
      r.eggsCollected ?? 0,
      r.avgWeightGrams ?? "",
    ]);

    const houseSlug = (selectedHouse?.name || "farm").toLowerCase().replace(/\s+/g, "_");
    exportToCsv(`daily_records_${houseSlug}_${new Date().toISOString().split("T")[0]}.csv`, headers, rows);
  };

  return (
    <div className="daily-records-page">
      <PageHeader
        eyebrow={selectedHouse ? `Poultry House: ${selectedHouse.name}` : undefined}
        title="Daily Production Records"
        description="Track mortality, feed usage in kilograms, bird weights, and daily eggs collected."
        actions={
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              className="secondary-button"
              onClick={handleExportCsv}
              disabled={filteredAndSortedRecords.length === 0}
              title="Export filtered records to CSV"
            >
              📥 Export CSV
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={() => navigate("/daily-records/new")}
            >
              <PlusIcon size={14} /> Add Daily Record
            </button>
          </div>
        }
      />

      <div className="records-section">
        {/* Section Toolbar with Date Filter, Flock Filter, and Sorting */}
        <div className="section-toolbar" style={{ flexWrap: "wrap", gap: 12 }}>
          <div className="search-input-wrapper">
            <label
              htmlFor="record-date-filter"
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--text-secondary)",
              }}
            >
              Date:
            </label>
            <input
              id="record-date-filter"
              type="date"
              className="table-filter-input"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            />
            {dateFilter && (
              <button
                type="button"
                className="clear-filter-btn"
                onClick={() => setDateFilter("")}
              >
                Clear
              </button>
            )}
          </div>

          {flocks && flocks.length > 0 && (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <label
                htmlFor="record-flock-filter"
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                }}
              >
                Flock:
              </label>
              <select
                id="record-flock-filter"
                value={flockFilter}
                onChange={(e) => setFlockFilter(e.target.value)}
                className="table-filter-input"
                style={{ padding: "4px 8px" }}
              >
                <option value="ALL">All Batches</option>
                <option value="NONE">Whole House Only</option>
                {flocks.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.purpose} · {f.status})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {filteredAndSortedRecords.length} record{filteredAndSortedRecords.length === 1 ? "" : "s"}
            </span>
            <button
              type="button"
              className="sort-toggle-btn"
              onClick={() =>
                setSortOrder((prev) => (prev === "newest" ? "oldest" : "newest"))
              }
              title="Toggle sorting order"
            >
              {sortOrder === "newest" ? "↓ Newest First" : "↑ Oldest First"}
            </button>
          </div>
        </div>

        {/* Table Content */}
        {filteredAndSortedRecords.length === 0 ? (
          <EmptyState
            icon="📋"
            title={dateFilter || flockFilter !== "ALL" ? "No matching records" : "No daily records yet"}
            message={
              dateFilter || flockFilter !== "ALL"
                ? "No production entries found matching your filter criteria."
                : "No daily records have been logged for this poultry house yet."
            }
            actionText={dateFilter || flockFilter !== "ALL" ? "Reset Filters" : "+ Add First Daily Record"}
            onAction={
              dateFilter || flockFilter !== "ALL"
                ? () => {
                    setDateFilter("");
                    setFlockFilter("ALL");
                  }
                : () => navigate("/daily-records/new")
            }
          />
        ) : (
          <>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Poultry House</th>
                    <th>Flock / Batch</th>
                    <th>Mortality</th>
                    <th>Feed Type</th>
                    <th>Feed Used</th>
                    <th>Eggs Collected</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedRecords.map((record) => (
                    <tr key={record.id}>
                      <td style={{ fontWeight: 600 }}>
                        {new Date(record.date).toLocaleDateString(undefined, {
                          weekday: "short",
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                      <td>{record.house?.name || selectedHouse?.name || "—"}</td>
                      <td>
                        {record.flock ? (
                          <span className="breed-chip" style={{ fontSize: 12 }}>
                            {record.flock.name} ({record.flock.purpose})
                          </span>
                        ) : (
                          <span style={{ color: "var(--text-muted)", fontSize: 12 }}>Whole House</span>
                        )}
                      </td>
                      <td>
                        <span
                          style={{
                            fontWeight: 600,
                            color:
                              (record.correctedMortality ?? record.mortality) > 0
                                ? "var(--alert-danger)"
                                : "inherit",
                          }}
                        >
                          {record.correctedMortality ?? record.mortality} birds
                        </span>
                        {record.corrections?.some((c) => c.field === "MORTALITY") && (
                          <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px" }}>
                            corrected (was {record.mortality})
                          </div>
                        )}
                      </td>
                      <td>
                        {record.feedType ? (
                          <span style={{ fontWeight: 600 }}>🌾 {record.feedType.name}</span>
                        ) : (
                          <span style={{ color: "var(--text-muted)", fontSize: 12 }}>—</span>
                        )}
                        {record.avgWeightGrams && (
                          <div style={{ fontSize: "11px", color: "var(--color-primary)", marginTop: "2px" }}>
                            ⚖️ {record.avgWeightGrams}g avg
                          </div>
                        )}
                      </td>
                      <td>
                        <strong>{Number(record.feedUsedKg).toFixed(1)} kg</strong>
                      </td>
                      <td>
                        <strong>{record.correctedEggs ?? record.eggsCollected}</strong> eggs
                        {record.corrections?.some((c) => c.field === "EGGS") && (
                          <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px" }}>
                            corrected (was {record.eggsCollected})
                          </div>
                        )}
                        {record.corrections?.length > 0 && (
                          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }} title={record.corrections.map((c) => `${new Date(c.createdAt).toLocaleDateString()}: ${c.field} ${c.previousValue} → ${c.correctedValue} (${c.reason})`).join("\n")}>
                          📝 {record.corrections.length} correction{record.corrections.length === 1 ? "" : "s"}
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div
                          className="record-actions"
                          style={{ justifyContent: "flex-end" }}
                        >
                          <button
                            type="button"
                            className="secondary-button"
                            style={{ padding: "4px 10px", fontSize: 12 }}
                            onClick={() => navigate(`/daily-records/${record.id}/edit`)}
                          >
                            Edit
                          </button>
                          {isOutsideWindow(record) && (
                            <button
                              type="button"
                              className="secondary-button"
                              style={{ padding: "4px 10px", fontSize: 12 }}
                              onClick={() => setCorrectingRecord(record)}
                              title="Record a correction for this immutable record"
                            >
                              Correct
                            </button>
                          )}
                          <button
                            type="button"
                            className="danger-button"
                            style={{ padding: "4px 10px", fontSize: 12 }}
                            onClick={() =>
                              setConfirmDialog({
                                type: "record",
                                id: record.id,
                              })
                            }
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Table Footer with Summary Stats */}
            <div className="records-footer">
              <span>
                Showing <strong>{filteredAndSortedRecords.length}</strong> of{" "}
                <strong>{records.length}</strong> total records
              </span>
              <div style={{ display: "flex", gap: 16 }}>
                <span>Total Mortality: <strong>{totalFilteredMortality}</strong></span>
                <span>Total Feed: <strong>{totalFilteredFeed.toFixed(1)} kg</strong></span>
                <span>Total Eggs: <strong>{totalFilteredEggs}</strong></span>
              </div>
            </div>
          </>
        )}
      </div>

      <CorrectionModal
        isOpen={Boolean(correctingRecord)}
        onClose={() => setCorrectingRecord(null)}
        onSaved={handleCorrectionSaved}
        record={correctingRecord}
      />
    </div>
  );
}

export default DailyRecordsPage;
