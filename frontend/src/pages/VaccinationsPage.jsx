import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useFarm } from "../context/useFarm";
import PageHeader from "../components/common/PageHeader";
import EmptyState from "../components/common/EmptyState";
import { PlusIcon, VaccineIcon } from "../components/Icons";
import VaccinationModal from "../components/VaccinationModal";
import { applyVaccinationTemplate } from "../services/api";

function VaccinationsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlFlockId = searchParams.get("flockId");

  const { vaccinations, flocks, selectedHouse, reloadHouseData, showToast, setConfirmDialog } =
    useFarm();

  const [flockFilter, setFlockFilter] = useState(urlFlockId || "ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingVaccination, setEditingVaccination] = useState(null);
  const [autoScheduling, setAutoScheduling] = useState(false);
  const [autoScheduleFlockId, setAutoScheduleFlockId] = useState(
    flocks?.[0]?.id ? String(flocks[0].id) : ""
  );
  const [showAutoScheduleModal, setShowAutoScheduleModal] = useState(false);

  const filteredVaccinations = useMemo(() => {
    return vaccinations.filter((v) => {
      if (flockFilter !== "ALL" && String(v.flockId) !== String(flockFilter)) return false;
      if (statusFilter !== "ALL" && v.status !== statusFilter) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        v.vaccineName?.toLowerCase().includes(q) ||
        v.disease?.toLowerCase().includes(q) ||
        v.notes?.toLowerCase().includes(q) ||
        v.flock?.name?.toLowerCase().includes(q)
      );
    });
  }, [vaccinations, flockFilter, statusFilter, searchQuery]);

  const pendingCount = vaccinations.filter((v) => v.status === "PENDING").length;
  const completedCount = vaccinations.filter((v) => v.status === "COMPLETED").length;
  const totalCost = vaccinations.reduce((sum, v) => sum + (Number(v.cost) || 0), 0);

  const handleOpenNew = () => {
    setEditingVaccination(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (vacc) => {
    setEditingVaccination(vacc);
    setModalOpen(true);
  };

  const handleApplyTemplate = async () => {
    if (!autoScheduleFlockId) {
      showToast("Please select a flock batch.", "error");
      return;
    }
    try {
      setAutoScheduling(true);
      const res = await applyVaccinationTemplate(Number(autoScheduleFlockId));
      showToast(res.message || "Vaccination program generated!");
      setShowAutoScheduleModal(false);
      await reloadHouseData();
    } catch (err) {
      showToast(err.message || "Failed to generate vaccination schedule.", "error");
    } finally {
      setAutoScheduling(false);
    }
  };

  return (
    <div className="vaccinations-page">
      <PageHeader
        eyebrow={selectedHouse ? `Poultry House: ${selectedHouse.name}` : undefined}
        title="Vaccination & Health Schedule"
        description="Schedule disease immunizations, monitor upcoming doses, and track preventive medicine costs."
        actions={
          <div style={{ display: "flex", gap: 10 }}>
            {flocks.length > 0 && (
              <button
                type="button"
                className="secondary-button"
                onClick={() => setShowAutoScheduleModal(true)}
              >
                ⚡ Auto-Schedule Protocol
              </button>
            )}
            <button
              type="button"
              className="primary-button"
              onClick={handleOpenNew}
              disabled={flocks.length === 0}
            >
              <PlusIcon size={14} /> Schedule Vaccination
            </button>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="dashboard-grid" style={{ marginBottom: 20 }}>
        <div className="card stat-card">
          <div className="stat-label">Pending Vaccinations</div>
          <div className="stat-value" style={{ color: pendingCount > 0 ? "var(--color-primary)" : "inherit" }}>
            {pendingCount}
          </div>
          <div className="stat-subtext">Awaiting administration</div>
        </div>

        <div className="card stat-card">
          <div className="stat-label">Completed Doses</div>
          <div className="stat-value" style={{ color: "var(--color-success)" }}>
            {completedCount}
          </div>
          <div className="stat-subtext">Successfully administered</div>
        </div>

        <div className="card stat-card">
          <div className="stat-label">Vaccine Investment</div>
          <div className="stat-value">GMD {totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          <div className="stat-subtext">Total medication expense</div>
        </div>
      </div>

      <div className="records-section">
        {/* Toolbar */}
        <div className="section-toolbar" style={{ flexWrap: "wrap", gap: 12 }}>
          <div className="search-input-wrapper">
            <input
              type="text"
              placeholder="Search vaccine, disease..."
              className="table-filter-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ minWidth: 200 }}
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

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <label htmlFor="flock-filter" style={{ fontSize: 12, fontWeight: 600 }}>
              Flock:
            </label>
            <select
              id="flock-filter"
              value={flockFilter}
              onChange={(e) => {
                setFlockFilter(e.target.value);
                if (e.target.value === "ALL") {
                  searchParams.delete("flockId");
                } else {
                  searchParams.set("flockId", e.target.value);
                }
                setSearchParams(searchParams);
              }}
              className="table-filter-input"
              style={{ padding: "4px 8px" }}
            >
              <option value="ALL">All Flocks</option>
              {flocks.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} ({f.purpose})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <label htmlFor="vacc-status-filter" style={{ fontSize: 12, fontWeight: 600 }}>
              Status:
            </label>
            <select
              id="vacc-status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="table-filter-input"
              style={{ padding: "4px 8px" }}
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="COMPLETED">Completed</option>
              <option value="MISSED">Missed</option>
            </select>
          </div>

          <div style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-muted)" }}>
            {filteredVaccinations.length} vaccination{filteredVaccinations.length === 1 ? "" : "s"}
          </div>
        </div>

        {flocks.length === 0 ? (
          <EmptyState
            icon="🐣"
            title="No Flocks Available"
            message="Vaccinations are scheduled per biological flock. Create your first flock to enable health scheduling."
            actionText="+ Create Flock / Batch"
            onAction={() => window.location.assign("/flocks/new")}
          />
        ) : filteredVaccinations.length === 0 ? (
          <EmptyState
            icon="💉"
            title={
              searchQuery || flockFilter !== "ALL" || statusFilter !== "ALL"
                ? "No matching vaccinations"
                : "No vaccinations scheduled yet"
            }
            message={
              searchQuery || flockFilter !== "ALL" || statusFilter !== "ALL"
                ? "No records match your filter criteria."
                : "Generate a recommended regional program or add custom vaccines."
            }
            actionText="⚡ Auto-Schedule Protocol"
            onAction={() => setShowAutoScheduleModal(true)}
          />
        ) : (
          <>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Vaccine & Disease</th>
                    <th>Flock</th>
                    <th>Target Age</th>
                    <th>Scheduled Date</th>
                    <th>Administered</th>
                    <th>Cost (GMD)</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVaccinations.map((vacc) => {
                    const isOverdue =
                      vacc.status === "PENDING" &&
                      new Date(vacc.scheduledDate).getTime() < Date.now() - 24 * 60 * 60 * 1000;

                    const statusClass =
                      vacc.status === "COMPLETED"
                        ? "badge-completed"
                        : isOverdue
                        ? "badge-due-soon"
                        : "badge-upcoming";

                    return (
                      <tr key={vacc.id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{vacc.vaccineName}</div>
                          {vacc.disease && (
                            <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                              Target: {vacc.disease}
                            </div>
                          )}
                          {vacc.dosage && (
                            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                              Dosage: {vacc.dosage}
                            </div>
                          )}
                        </td>
                        <td>
                          <span className="breed-chip" style={{ fontSize: 12 }}>
                            {vacc.flock?.name || `Flock #${vacc.flockId}`}
                          </span>
                        </td>
                        <td>
                          {vacc.targetAgeDays !== null ? (
                            <strong>Day {vacc.targetAgeDays}</strong>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>
                            {new Date(vacc.scheduledDate).toLocaleDateString(undefined, {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                          </div>
                          {isOverdue && (
                            <span style={{ fontSize: 10, color: "var(--alert-danger)", fontWeight: 700 }}>
                              OVERDUE
                            </span>
                          )}
                        </td>
                        <td>
                          {vacc.administeredDate ? (
                            <div>
                              <div>
                                {new Date(vacc.administeredDate).toLocaleDateString(undefined, {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                })}
                              </div>
                              {vacc.administeredBy && (
                                <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                                  By: {vacc.administeredBy}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: "var(--text-muted)" }}>—</span>
                          )}
                        </td>
                        <td>
                          {Number(vacc.cost) > 0 ? (
                            <span>GMD {Number(vacc.cost).toFixed(2)}</span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td>
                          <span className={`badge ${statusClass}`}>
                            {isOverdue ? "Overdue" : vacc.status}
                          </span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div className="record-actions" style={{ justifyContent: "flex-end", gap: 6 }}>
                            <button
                              type="button"
                              className="secondary-button"
                              style={{ padding: "4px 8px", fontSize: 11 }}
                              onClick={() => handleOpenEdit(vacc)}
                            >
                              {vacc.status === "PENDING" ? "Record Done" : "Edit"}
                            </button>
                            <button
                              type="button"
                              className="danger-button"
                              style={{ padding: "4px 8px", fontSize: 11 }}
                              onClick={() =>
                                setConfirmDialog({
                                  type: "vaccination",
                                  id: vacc.id,
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
                Showing <strong>{filteredVaccinations.length}</strong> vaccination entries
              </span>
              <span>
                Pending: <strong>{pendingCount}</strong> | Completed: <strong>{completedCount}</strong>
              </span>
            </div>
          </>
        )}
      </div>

      {/* Auto-Schedule Modal */}
      {showAutoScheduleModal && (
        <div className="dialog-overlay" onClick={() => setShowAutoScheduleModal(false)}>
          <div
            className="form-card"
            style={{ maxWidth: 480, width: "90%", margin: "40px auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="form-header">
              <div>
                <h2>Auto-Schedule Protocol</h2>
                <p>Generates standard Gambia / West Africa poultry immunization program.</p>
              </div>
              <button
                type="button"
                className="close-button"
                onClick={() => setShowAutoScheduleModal(false)}
              >
                ×
              </button>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div className="form-group">
                <label htmlFor="autoFlock">Select Flock / Batch</label>
                <select
                  id="autoFlock"
                  value={autoScheduleFlockId}
                  onChange={(e) => setAutoScheduleFlockId(e.target.value)}
                >
                  {flocks.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.purpose} - Placed {new Date(f.placementDate).toLocaleDateString()})
                    </option>
                  ))}
                </select>
              </div>

              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-secondary)",
                  background: "var(--bg-muted)",
                  padding: 12,
                  borderRadius: 6,
                  marginTop: 8,
                }}
              >
                <strong>Protocol includes:</strong>
                <ul style={{ margin: "6px 0 0 16px", padding: 0 }}>
                  <li>Day 1: Newcastle Disease + Infectious Bronchitis (ND+IB)</li>
                  <li>Day 7: Gumboro (IBD Intermediate)</li>
                  <li>Day 14: Gumboro Booster</li>
                  <li>Day 21: Newcastle LaSota Booster (plus Layer boosters if layer)</li>
                </ul>
              </div>
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setShowAutoScheduleModal(false)}
                disabled={autoScheduling}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={handleApplyTemplate}
                disabled={autoScheduling || !autoScheduleFlockId}
              >
                {autoScheduling ? "Generating..." : "Generate Program"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Add / Edit Modal */}
      <VaccinationModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={reloadHouseData}
        vaccination={editingVaccination}
        flockId={flockFilter !== "ALL" ? flockFilter : flocks?.[0]?.id}
        flocks={flocks}
      />
    </div>
  );
}

export default VaccinationsPage;
