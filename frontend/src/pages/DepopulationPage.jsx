import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useFarm } from "../context/useFarm";
import PageHeader from "../components/common/PageHeader";
import EmptyState from "../components/common/EmptyState";
import { PlusIcon } from "../components/Icons";
import DepopulationModal from "../components/DepopulationModal";
import { getDepopulationEvents, deleteDepopulationEvent } from "../services/api";

const REASON_BADGES = {
  SOLD: { label: "SOLD", className: "badge-completed", color: "#16a34a" },
  SLAUGHTERED: { label: "SLAUGHTERED", className: "badge-due-soon", color: "#9333ea" },
  CULLED: { label: "CULLED", className: "badge-overdue", color: "#ea580c" },
  TRANSFERRED: { label: "TRANSFERRED", className: "badge-upcoming", color: "#2563eb" },
  OTHER: { label: "OTHER", className: "badge-upcoming", color: "#64748b" },
};

function DepopulationPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlFlockId = searchParams.get("flockId");

  const { flocks = [], selectedHouse, reloadHouseData, showToast, setConfirmDialog } = useFarm();

  const [selectedFlockId, setSelectedFlockId] = useState(
    urlFlockId || (flocks[0]?.id ? String(flocks[0].id) : "ALL")
  );
  const [reasonFilter, setReasonFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const [events, setEvents] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);

  // Sync with URL query parameter
  useEffect(() => {
    if (urlFlockId) {
      setSelectedFlockId(urlFlockId);
    }
  }, [urlFlockId]);

  // Load depopulation events from API
  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (selectedFlockId && selectedFlockId !== "ALL") {
        params.flockId = selectedFlockId;
      }
      const res = await getDepopulationEvents(params);
      if (res.data) {
        if (Array.isArray(res.data.events)) {
          setEvents(res.data.events);
          setSummary(res.data.summary || null);
        } else if (Array.isArray(res.data)) {
          setEvents(res.data);
          setSummary(null);
        }
      }
    } catch (err) {
      console.error("Failed to fetch depopulation events:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedFlockId]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Find currently selected flock object
  const activeFlockObj = useMemo(() => {
    if (!selectedFlockId || selectedFlockId === "ALL") return null;
    return flocks.find((f) => String(f.id) === String(selectedFlockId)) || null;
  }, [flocks, selectedFlockId]);

  // Filter events by reason and search
  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (reasonFilter !== "ALL" && e.reason !== reasonFilter) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        e.notes?.toLowerCase().includes(q) ||
        e.reason?.toLowerCase().includes(q) ||
        e.flock?.name?.toLowerCase().includes(q)
      );
    });
  }, [events, reasonFilter, searchQuery]);

  // Depopulation aggregations
  const totalDepopQuantity = events.reduce((sum, e) => sum + (e.quantity || 0), 0);
  const soldCount = events.filter((e) => e.reason === "SOLD").reduce((sum, e) => sum + e.quantity, 0);
  const slaughteredCount = events.filter((e) => e.reason === "SLAUGHTERED").reduce((sum, e) => sum + e.quantity, 0);
  const culledCount = events.filter((e) => e.reason === "CULLED").reduce((sum, e) => sum + e.quantity, 0);
  const transferredCount = events.filter((e) => e.reason === "TRANSFERRED").reduce((sum, e) => sum + e.quantity, 0);

  const handleFlockChange = (newId) => {
    setSelectedFlockId(newId);
    if (newId === "ALL") {
      searchParams.delete("flockId");
    } else {
      searchParams.set("flockId", newId);
    }
    setSearchParams(searchParams);
  };

  const handleOpenNew = () => {
    setEditingEvent(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (event) => {
    setEditingEvent(event);
    setModalOpen(true);
  };

  const handleDelete = (eventId) => {
    setConfirmDialog({
      title: "Delete Depopulation Event",
      message: "Are you sure you want to delete this depopulation event? The removed birds will be restored to the flock's live count.",
      confirmLabel: "Delete Event",
      isDangerous: true,
      onConfirm: async () => {
        try {
          await deleteDepopulationEvent(eventId);
          await fetchEvents();
          await reloadHouseData();
          showToast("Depopulation event deleted. Live birds restored.");
        } catch (err) {
          showToast(err.message || "Failed to delete depopulation event.", "error");
        }
      },
    });
  };

  const handleSuccess = async () => {
    setModalOpen(false);
    await fetchEvents();
    await reloadHouseData();
    showToast(editingEvent ? "Depopulation event updated successfully." : "Depopulation event recorded successfully.");
  };

  return (
    <div className="depopulation-page">
      <PageHeader
        eyebrow={selectedHouse ? `Poultry House: ${selectedHouse.name}` : undefined}
        title="Bird Depopulation & Harvest Management"
        description="Track bird sales, slaughter harvests, culling, and transfers. Live bird populations are accurately calculated as Placed - Mortality - Depopulated."
        actions={
          <button
            type="button"
            className="primary-button"
            onClick={handleOpenNew}
            disabled={flocks.length === 0}
          >
            <PlusIcon size={14} /> Record Depopulation Event
          </button>
        }
      />

      {/* Critical Concept Alert: Depopulation vs Mortality */}
      <div
        className="info-banner"
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
          background: "#f0fdf4",
          border: "1px solid #bbf7d0",
          borderRadius: 8,
          padding: "14px 18px",
          marginBottom: 20,
          color: "#166534",
          fontSize: 13,
          lineHeight: 1.5,
        }}
      >
        <div style={{ fontSize: 20, lineHeight: 1 }}>ℹ️</div>
        <div>
          <strong style={{ display: "block", marginBottom: 2 }}>
            Biological Bird Accounting: Depopulation vs. Mortality
          </strong>
          <span>
            <strong>Mortality</strong> represents biological deaths and is recorded in <em>Daily Records</em>.{" "}
            <strong>Depopulation</strong> represents intentional removals (commercial sales, slaughter harvests, culling, or transfers).
            Both reduce total available birds:{" "}
            <code style={{ background: "#dcfce7", padding: "2px 6px", borderRadius: 4, fontWeight: 700 }}>
              Live Birds = Birds Placed - Total Mortality - Total Depopulated
            </code>
          </span>
        </div>
      </div>

      {/* Flock Selector & Live Population KPI Header */}
      <div
        className="card"
        style={{
          padding: 18,
          marginBottom: 20,
          background: "var(--card-bg)",
          borderRadius: 8,
          border: "1px solid var(--border-color)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <label htmlFor="active-flock-filter" style={{ fontWeight: 700, fontSize: 14 }}>
              Active Flock / Batch:
            </label>
            <select
              id="active-flock-filter"
              value={selectedFlockId}
              onChange={(e) => handleFlockChange(e.target.value)}
              className="table-filter-input"
              style={{ padding: "8px 12px", minWidth: 240, fontWeight: 600, fontSize: 14 }}
            >
              <option value="ALL">All Flocks (Overview)</option>
              {flocks.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} ({f.purpose}) — {f.currentBirds} Live Birds
                </option>
              ))}
            </select>
          </div>

          {activeFlockObj && (
            <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              Placement Date: <strong>{new Date(activeFlockObj.placementDate).toLocaleDateString()}</strong> · Status: <strong>{activeFlockObj.status}</strong>
            </div>
          )}
        </div>

        {/* Live Population Formula Banner when a flock is selected */}
        {activeFlockObj && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: 14,
              marginTop: 18,
              paddingTop: 16,
              borderTop: "1px solid var(--border-color)",
            }}
          >
            <div className="metric-pill" style={{ padding: 14 }}>
              <span className="metric-name" style={{ fontSize: 12 }}>1. Birds Placed</span>
              <strong className="metric-val" style={{ fontSize: 22 }}>
                {summary?.birdsPlaced ?? activeFlockObj.birdsPlaced}
              </strong>
            </div>

            <div className="metric-pill" style={{ padding: 14 }}>
              <span className="metric-name" style={{ fontSize: 12, color: "var(--alert-danger)" }}>
                2. Total Mortality (−)
              </span>
              <strong className="metric-val" style={{ fontSize: 22, color: "var(--alert-danger)" }}>
                {summary?.totalMortality ?? activeFlockObj.totalMortality ?? 0}
              </strong>
              <small style={{ fontSize: 11, color: "var(--text-muted)" }}>Logged via Daily Records</small>
            </div>

            <div className="metric-pill" style={{ padding: 14 }}>
              <span className="metric-name" style={{ fontSize: 12, color: "#9333ea" }}>
                3. Total Depopulated (−)
              </span>
              <strong className="metric-val" style={{ fontSize: 22, color: "#9333ea" }}>
                {summary?.totalDepopulated ?? activeFlockObj.totalDepopulated ?? totalDepopQuantity}
              </strong>
              <small style={{ fontSize: 11, color: "var(--text-muted)" }}>Sales, harvest, culls, etc.</small>
            </div>

            <div
              className="metric-pill"
              style={{
                padding: 14,
                background: "#f0fdf4",
                border: "2px solid #86efac",
                borderRadius: 8,
              }}
            >
              <span className="metric-name" style={{ fontSize: 12, color: "#166534", fontWeight: 700 }}>
                Current Live Birds (=)
              </span>
              <strong className="metric-val" style={{ fontSize: 26, color: "#15803d" }}>
                {summary?.liveBirds ?? activeFlockObj.currentBirds}
              </strong>
              <small style={{ fontSize: 11, color: "#166534" }}>Available Headroom</small>
            </div>
          </div>
        )}
      </div>

      {/* Depopulation Breakdown KPI Grid */}
      <div className="dashboard-grid" style={{ marginBottom: 20 }}>
        <div className="card stat-card">
          <div className="stat-label">Total Depopulated Birds</div>
          <div className="stat-value" style={{ color: "#9333ea" }}>{totalDepopQuantity.toLocaleString()}</div>
          <div className="stat-subtext">Across {events.length} recorded events</div>
        </div>

        <div className="card stat-card">
          <div className="stat-label">Sold for Meat / Revenue</div>
          <div className="stat-value" style={{ color: "#16a34a" }}>{soldCount.toLocaleString()}</div>
          <div className="stat-subtext">Commercial bird sales</div>
        </div>

        <div className="card stat-card">
          <div className="stat-label">Slaughtered / Harvested</div>
          <div className="stat-value" style={{ color: "#7c3aed" }}>{slaughteredCount.toLocaleString()}</div>
          <div className="stat-subtext">Processed harvests</div>
        </div>

        <div className="card stat-card">
          <div className="stat-label">Culled & Transferred</div>
          <div className="stat-value" style={{ color: "#ea580c" }}>{(culledCount + transferredCount).toLocaleString()}</div>
          <div className="stat-subtext">{culledCount} culled · {transferredCount} transferred</div>
        </div>
      </div>

      {/* History Table Section */}
      <div className="records-section">
        {/* Toolbar with Filters */}
        <div className="section-toolbar" style={{ flexWrap: "wrap", gap: 12 }}>
          <div className="search-input-wrapper">
            <input
              type="text"
              placeholder="Search notes, reasons, or flocks..."
              className="table-filter-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ minWidth: 240 }}
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
            <label htmlFor="reason-filter" style={{ fontSize: 12, fontWeight: 600 }}>
              Reason:
            </label>
            <select
              id="reason-filter"
              value={reasonFilter}
              onChange={(e) => setReasonFilter(e.target.value)}
              className="table-filter-input"
              style={{ padding: "4px 8px" }}
            >
              <option value="ALL">All Reasons</option>
              <option value="SOLD">Sold</option>
              <option value="SLAUGHTERED">Slaughtered</option>
              <option value="CULLED">Culled</option>
              <option value="TRANSFERRED">Transferred</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <div style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-muted)" }}>
            {filteredEvents.length} event{filteredEvents.length === 1 ? "" : "s"} shown
          </div>
        </div>

        {/* History Table */}
        {loading ? (
          <div style={{ padding: "30px", textAlign: "center", color: "var(--text-secondary)" }}>
            Loading depopulation history...
          </div>
        ) : filteredEvents.length === 0 ? (
          <EmptyState
            icon="🚚"
            title={
              searchQuery || reasonFilter !== "ALL"
                ? "No matching depopulation events found"
                : "No depopulation events recorded yet"
            }
            message={
              searchQuery || reasonFilter !== "ALL"
                ? "No events match your filter criteria."
                : "Record bird sales, harvest completions, or culls to keep live bird populations accurate."
            }
            actionText="+ Record First Depopulation Event"
            onAction={handleOpenNew}
          />
        ) : (
          <>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Flock / Batch</th>
                    <th>Reason</th>
                    <th style={{ textAlign: "right" }}>Quantity</th>
                    <th>Notes / Purpose</th>
                    <th>Financial Link</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEvents.map((evt) => {
                    const badgeInfo = REASON_BADGES[evt.reason] || REASON_BADGES.OTHER;
                    const eventDate = new Date(evt.date).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    });

                    return (
                      <tr key={evt.id}>
                        <td>
                          <strong>{eventDate}</strong>
                        </td>
                        <td>
                          <div>
                            <strong>{evt.flock?.name || `Flock #${evt.flockId}`}</strong>
                            {evt.flock?.batchNumber && (
                              <span style={{ marginLeft: 6, fontSize: 11, color: "var(--text-secondary)" }}>
                                (#{evt.flock.batchNumber})
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span
                            className={`badge ${badgeInfo.className}`}
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              textTransform: "uppercase",
                              letterSpacing: "0.5px",
                            }}
                          >
                            {badgeInfo.label}
                          </span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <strong style={{ fontSize: 15 }}>{evt.quantity.toLocaleString()}</strong>{" "}
                          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>birds</span>
                        </td>
                        <td>
                          {evt.notes ? (
                            <span>{evt.notes}</span>
                          ) : (
                            <span style={{ color: "var(--text-muted)", fontStyle: "italic", fontSize: 12 }}>
                              No notes entered
                            </span>
                          )}
                        </td>
                        <td>
                          {evt.income ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--color-primary)" }}>
                                  💰 {Number(evt.income.amount).toLocaleString()} GMD
                                </span>
                                <span
                                  className={`badge ${
                                    evt.income.paymentStatus === "PAID"
                                      ? "badge-completed"
                                      : evt.income.paymentStatus === "PARTIALLY_PAID"
                                      ? "badge-due-soon"
                                      : "badge-overdue"
                                  }`}
                                  style={{ fontSize: 10, padding: "2px 6px" }}
                                >
                                  {evt.income.paymentStatus || "PAID"}
                                </span>
                              </div>
                              {evt.income.customer?.name && (
                                <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                                  Buyer: <strong>{evt.income.customer.name}</strong>
                                </span>
                              )}
                              {Number(evt.income.amountDue || 0) > 0 && (
                                <span style={{ fontSize: 11, color: "var(--alert-danger)" }}>
                                  Due: {Number(evt.income.amountDue).toLocaleString()} GMD
                                </span>
                              )}
                            </div>
                          ) : (
                            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>—</span>
                          )}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div className="record-actions" style={{ justifyContent: "flex-end", gap: 6 }}>
                            <button
                              type="button"
                              className="secondary-button"
                              style={{ padding: "4px 8px", fontSize: 11 }}
                              onClick={() => handleOpenEdit(evt)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="danger-button"
                              style={{ padding: "4px 8px", fontSize: 11 }}
                              onClick={() => handleDelete(evt.id)}
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
                Total Events Logged: <strong>{filteredEvents.length}</strong>
              </span>
              <span>
                Total Depopulated: <strong>{totalDepopQuantity.toLocaleString()} birds</strong>
              </span>
            </div>
          </>
        )}
      </div>

      {/* Depopulation Modal for Recording or Editing */}
      <DepopulationModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={handleSuccess}
        event={editingEvent}
        flockId={selectedFlockId !== "ALL" ? selectedFlockId : undefined}
        flocks={flocks}
      />
    </div>
  );
}

export default DepopulationPage;
