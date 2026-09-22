import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFarm } from "../context/useFarm";
import PageHeader from "../components/common/PageHeader";
import EmptyState from "../components/common/EmptyState";
import { PlusIcon, VaccineIcon } from "../components/Icons";
import { exportToCsv } from "../utils/exportCsv";

function FlocksPage() {
  const navigate = useNavigate();
  const { flocks, selectedHouse, setConfirmDialog } = useFarm();

  const [statusFilter, setStatusFilter] = useState("ALL");
  const [purposeFilter, setPurposeFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredFlocks = flocks.filter((flock) => {
    if (statusFilter !== "ALL" && flock.status !== statusFilter) return false;
    if (purposeFilter !== "ALL" && flock.purpose !== purposeFilter) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      flock.name?.toLowerCase().includes(q) ||
      flock.batchNumber?.toLowerCase().includes(q) ||
      flock.notes?.toLowerCase().includes(q)
    );
  });

  const activeFlocks = flocks.filter((f) => f.status === "ACTIVE");
  const totalActiveBirds = activeFlocks.reduce((sum, f) => sum + (f.currentBirds || 0), 0);
  const totalBirdsPlaced = activeFlocks.reduce((sum, f) => sum + (f.birdsPlaced || 0), 0);
  const totalActiveMortality = activeFlocks.reduce((sum, f) => sum + (f.totalMortality || 0), 0);
  const avgMortalityRate =
    totalBirdsPlaced > 0 ? ((totalActiveMortality / totalBirdsPlaced) * 100).toFixed(1) : "0.0";

  const handleExportCsv = () => {
    const headers = [
      "Flock Name",
      "Batch Number",
      "House",
      "Breed",
      "Purpose",
      "Status",
      "Birds Placed",
      "Current Live Birds",
      "Total Mortality",
      "Mortality Rate (%)",
      "Age",
      "Total Feed Used (kg)",
      "Latest Avg Weight (g)",
      "FCR",
      "Total Eggs",
      "Latest Laying Rate (%)",
      "Placement Date",
      "Expected Market Date",
    ];

    const rows = filteredFlocks.map((f) => [
      f.name,
      f.batchNumber || "",
      f.houseName || selectedHouse?.name || "",
      f.breedName || "",
      f.purpose,
      f.status,
      f.birdsPlaced,
      f.currentBirds,
      f.totalMortality,
      f.mortalityRate,
      f.age?.formatted || "",
      f.totalFeedUsedKg,
      f.latestAvgWeightGrams || "",
      f.fcr ?? "",
      f.totalEggs,
      f.latestLayingRate !== null ? `${f.latestLayingRate}%` : "",
      new Date(f.placementDate).toISOString().split("T")[0],
      f.expectedMarketDate ? new Date(f.expectedMarketDate).toISOString().split("T")[0] : "",
    ]);

    const houseSlug = (selectedHouse?.name || "farm").toLowerCase().replace(/\s+/g, "_");
    exportToCsv(`flocks_summary_${houseSlug}_${new Date().toISOString().split("T")[0]}.csv`, headers, rows);
  };

  return (
    <div className="flocks-page">
      <PageHeader
        eyebrow={selectedHouse ? `Poultry House: ${selectedHouse.name}` : undefined}
        title="Flock & Batch Management"
        description="Track biological groups of birds, manage growth cycles, mortality rates, FCR, and laying percentages."
        actions={
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              className="secondary-button"
              onClick={handleExportCsv}
              disabled={filteredFlocks.length === 0}
              title="Export flocks to CSV"
            >
              📥 Export CSV
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={() => navigate("/flocks/new")}
            >
              <PlusIcon size={14} /> New Flock / Batch
            </button>
          </div>
        }
      />

      {/* Summary KPI Cards for Active Flocks */}
      <div className="dashboard-grid" style={{ marginBottom: 20 }}>
        <div className="card stat-card">
          <div className="stat-label">Active Batches</div>
          <div className="stat-value">{activeFlocks.length}</div>
          <div className="stat-subtext">Currently housed in {selectedHouse?.name || "farm"}</div>
        </div>

        <div className="card stat-card">
          <div className="stat-label">Live Birds in Flocks</div>
          <div className="stat-value">{totalActiveBirds.toLocaleString()}</div>
          <div className="stat-subtext">
            from {totalBirdsPlaced.toLocaleString()} placed
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-label">Batch Mortality Rate</div>
          <div
            className="stat-value"
            style={{
              color: Number(avgMortalityRate) > 5 ? "var(--alert-danger)" : "var(--color-primary)",
            }}
          >
            {avgMortalityRate}%
          </div>
          <div className="stat-subtext">{totalActiveMortality} total deaths recorded</div>
        </div>

        <div className="card stat-card">
          <div className="stat-label">Vaccination Programs</div>
          <div className="stat-value">
            <button
              type="button"
              className="secondary-button"
              style={{ padding: "6px 12px", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}
              onClick={() => navigate("/vaccinations")}
            >
              <VaccineIcon size={14} /> View Vaccine Schedule
            </button>
          </div>
          <div className="stat-subtext">Preventive health programs</div>
        </div>
      </div>

      <div className="records-section">
        {/* Section Toolbar with Filters */}
        <div className="section-toolbar" style={{ flexWrap: "wrap", gap: 12 }}>
          <div className="search-input-wrapper">
            <input
              type="text"
              placeholder="Search flock name or batch #..."
              className="table-filter-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ minWidth: 220 }}
            />
            {searchQuery && (
              <button
                type="button"
                className="clear-filter-btn"
                onClick={() => setSearchQuery("")}
              >
                Clear
              </button>
            )}
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <label htmlFor="status-filter" style={{ fontSize: 12, fontWeight: 600 }}>
              Status:
            </label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="table-filter-input"
              style={{ padding: "4px 8px" }}
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="COMPLETED">Completed</option>
              <option value="SOLD">Sold</option>
              <option value="SLAUGHTERED">Slaughtered</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <label htmlFor="purpose-filter" style={{ fontSize: 12, fontWeight: 600 }}>
              Purpose:
            </label>
            <select
              id="purpose-filter"
              value={purposeFilter}
              onChange={(e) => setPurposeFilter(e.target.value)}
              className="table-filter-input"
              style={{ padding: "4px 8px" }}
            >
              <option value="ALL">All Types</option>
              <option value="BROILER">Broiler (Meat)</option>
              <option value="LAYER">Layer (Eggs)</option>
              <option value="BREEDER">Breeder</option>
              <option value="DUAL_PURPOSE">Dual Purpose</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <div style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-muted)" }}>
            {filteredFlocks.length} flock{filteredFlocks.length === 1 ? "" : "s"} shown
          </div>
        </div>

        {filteredFlocks.length === 0 ? (
          <EmptyState
            icon="🐣"
            title={
              searchQuery || statusFilter !== "ALL" || purposeFilter !== "ALL"
                ? "No matching flocks found"
                : "No flocks registered yet"
            }
            message={
              searchQuery || statusFilter !== "ALL" || purposeFilter !== "ALL"
                ? "No flocks match your filter criteria."
                : "Start tracking batches by creating your first flock for this poultry house."
            }
            actionText="+ Create First Flock / Batch"
            onAction={() => navigate("/flocks/new")}
          />
        ) : (
          <>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Flock / Batch</th>
                    <th>Purpose</th>
                    <th>Age</th>
                    <th>Live / Placed Birds</th>
                    <th>Mortality</th>
                    <th>FCR & Weight</th>
                    <th>Performance</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFlocks.map((flock) => {
                    const statusBadgeClass =
                      flock.status === "ACTIVE"
                        ? "badge-upcoming"
                        : flock.status === "COMPLETED"
                        ? "badge-completed"
                        : "badge-due-soon";

                    return (
                      <tr key={flock.id}>
                        <td>
                          <div>
                            <strong style={{ fontSize: 14 }}>{flock.name}</strong>
                            {flock.batchNumber && (
                              <span style={{ marginLeft: 6, fontSize: 11, color: "var(--text-secondary)" }}>
                                (#{flock.batchNumber})
                              </span>
                            )}
                          </div>
                          {flock.breedName && (
                            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                              Breed: {flock.breedName}
                            </div>
                          )}
                        </td>
                        <td>
                          <span
                            className="breed-chip"
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              textTransform: "uppercase",
                            }}
                          >
                            {flock.purpose}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>
                            {flock.age?.formatted || "—"}
                          </div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                            Placed: {new Date(flock.placementDate).toLocaleDateString()}
                          </div>
                        </td>
                        <td>
                          <div>
                            <strong style={{ fontSize: 14 }}>{flock.currentBirds}</strong> live
                          </div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                            of {flock.birdsPlaced} placed
                          </div>
                          {flock.totalDepopulated > 0 && (
                            <div style={{ fontSize: 10, color: "#9333ea", fontWeight: 600 }}>
                              −{flock.totalDepopulated} depopulated
                            </div>
                          )}
                        </td>
                        <td>
                          <div
                            style={{
                              fontWeight: 600,
                              color: flock.totalMortality > 0 ? "var(--alert-danger)" : "inherit",
                            }}
                          >
                            {flock.totalMortality} birds
                          </div>
                          <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                            {flock.mortalityRate}% loss
                          </div>
                        </td>
                        <td>
                          {flock.fcr !== null ? (
                            <div>
                              <strong>FCR: {flock.fcr}</strong>
                              <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                                Weight: {flock.latestAvgWeightGrams}g
                              </div>
                            </div>
                          ) : flock.latestAvgWeightGrams ? (
                            <div style={{ fontSize: 12 }}>
                              Weight: {flock.latestAvgWeightGrams}g
                              <div style={{ fontSize: 10, color: "var(--text-muted)" }}>FCR pending</div>
                            </div>
                          ) : (
                            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>—</span>
                          )}
                        </td>
                        <td>
                          {flock.purpose === "LAYER" ? (
                            <div>
                              <strong style={{ color: "var(--color-primary)" }}>
                                {flock.latestLayingRate !== null ? `${flock.latestLayingRate}%` : "—"}
                              </strong>
                              <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                                {flock.totalEggs} eggs total
                              </div>
                            </div>
                          ) : (
                            <div style={{ fontSize: 12 }}>
                              {flock.totalFeedUsedKg} kg feed
                              {flock.targetWeightKg && (
                                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                                  Target: {flock.targetWeightKg} kg
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td>
                          <span className={`badge ${statusBadgeClass}`}>
                            {flock.status}
                          </span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div className="record-actions" style={{ justifyContent: "flex-end", gap: 6 }}>
                            <button
                              type="button"
                              className="secondary-button"
                              style={{ padding: "4px 8px", fontSize: 11 }}
                              title="Record bird sales, harvest, or culls"
                              onClick={() => navigate(`/depopulation?flockId=${flock.id}`)}
                            >
                              🚚 Depopulate
                            </button>
                            <button
                              type="button"
                              className="secondary-button"
                              style={{ padding: "4px 8px", fontSize: 11 }}
                              title="Vaccine program"
                              onClick={() => navigate(`/vaccinations?flockId=${flock.id}`)}
                            >
                              💉 Vaccines
                            </button>
                            <button
                              type="button"
                              className="secondary-button"
                              style={{ padding: "4px 8px", fontSize: 11 }}
                              onClick={() => navigate(`/flocks/${flock.id}/edit`)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="danger-button"
                              style={{ padding: "4px 8px", fontSize: 11 }}
                              onClick={() =>
                                setConfirmDialog({
                                  type: "flock",
                                  id: flock.id,
                                  name: flock.name,
                                })
                              }
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="records-footer">
              <span>
                Total Flocks in House: <strong>{filteredFlocks.length}</strong>
              </span>
              <span>
                Total Live Birds: <strong>{totalActiveBirds.toLocaleString()}</strong>
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default FlocksPage;
