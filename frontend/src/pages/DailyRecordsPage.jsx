import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFarm } from "../context/useFarm";
import PageHeader from "../components/common/PageHeader";
import EmptyState from "../components/common/EmptyState";
import { PlusIcon } from "../components/Icons";

function DailyRecordsPage() {
  const navigate = useNavigate();
  const { records, selectedHouse, setConfirmDialog } = useFarm();

  const [dateFilter, setDateFilter] = useState("");
  const [sortOrder, setSortOrder] = useState("newest"); // "newest" | "oldest"

  const filteredAndSortedRecords = [...records]
    .filter((record) => {
      if (!dateFilter) return true;
      return record.date && record.date.includes(dateFilter);
    })
    .sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
    });

  const totalFilteredMortality = filteredAndSortedRecords.reduce(
    (sum, r) => sum + (r.mortality || 0),
    0
  );
  const totalFilteredFeed = filteredAndSortedRecords.reduce(
    (sum, r) => sum + (Number(r.feedUsedKg) || 0),
    0
  );
  const totalFilteredEggs = filteredAndSortedRecords.reduce(
    (sum, r) => sum + (r.eggsCollected || 0),
    0
  );

  return (
    <div className="daily-records-page">
      <PageHeader
        eyebrow={selectedHouse ? `Poultry House: ${selectedHouse.name}` : undefined}
        title="Daily Production Records"
        description="Track mortality, feed usage in kilograms, and daily eggs collected."
        actions={
          <button
            type="button"
            className="primary-button"
            onClick={() => navigate("/daily-records/new")}
          >
            <PlusIcon size={14} /> Add Daily Record
          </button>
        }
      />

      <div className="records-section">
        {/* Section Toolbar with Date Filter and Sorting */}
        <div className="section-toolbar">
          <div className="search-input-wrapper">
            <label
              htmlFor="record-date-filter"
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--text-secondary)",
              }}
            >
              Filter by Date:
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

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
            title={dateFilter ? "No matching records" : "No daily records yet"}
            message={
              dateFilter
                ? `No production entries found matching date "${dateFilter}".`
                : "No daily records have been logged for this poultry house yet."
            }
            actionText={dateFilter ? "Clear Date Filter" : "+ Add First Daily Record"}
            onAction={
              dateFilter
                ? () => setDateFilter("")
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
                    <th>Flock / Batch</th>
                    <th>Mortality</th>
                    <th>Feed & Weight</th>
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
                              record.mortality > 0
                                ? "var(--alert-danger)"
                                : "inherit",
                          }}
                        >
                          {record.mortality} birds
                        </span>
                      </td>
                      <td>
                        <div>{Number(record.feedUsedKg).toFixed(1)} kg</div>
                        {record.feedType && (
                          <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px" }}>
                            🌾 {record.feedType.name}
                          </div>
                        )}
                        {record.avgWeightGrams && (
                          <div style={{ fontSize: "11px", color: "var(--color-primary)", marginTop: "2px" }}>
                            ⚖️ {record.avgWeightGrams}g avg
                          </div>
                        )}
                      </td>
                      <td>
                        <strong>{record.eggsCollected}</strong> eggs
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
    </div>
  );
}

export default DailyRecordsPage;
