import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFarm } from "../context/useFarm";
import PageHeader from "../components/common/PageHeader";
import EmptyState from "../components/common/EmptyState";
import { PlusIcon } from "../components/Icons";

function SlaughterPlanningPage() {
  const navigate = useNavigate();
  const {
    slaughterPlans,
    breeds,
    selectedHouse,
    setConfirmDialog,
    toggleSlaughterCompleteHandler,
  } = useFarm();

  const [statusFilter, setStatusFilter] = useState("all");

  const breedMap = new Map(breeds.map((b) => [b.id, b.name]));

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case "Overdue":
        return "badge badge-overdue";
      case "Due today":
        return "badge badge-due-today";
      case "Due soon":
        return "badge badge-due-soon";
      case "Completed":
        return "badge badge-completed";
      case "Upcoming":
      default:
        return "badge badge-upcoming";
    }
  };

  const filteredPlans = slaughterPlans.filter((plan) => {
    if (statusFilter === "all") return true;
    if (statusFilter === "Completed") return plan.status === "Completed";
    if (statusFilter === "Upcoming") return plan.computedStatus === "Upcoming";
    if (statusFilter === "Overdue") return plan.computedStatus === "Overdue";
    if (statusFilter === "Due today") return plan.computedStatus === "Due today";
    if (statusFilter === "Due soon") return plan.computedStatus === "Due soon";
    return true;
  });

  const totalBirdsPlanned = filteredPlans.reduce(
    (sum, p) => sum + (p.numberOfBirds || 0),
    0
  );

  return (
    <div className="slaughter-planning-page">
      <PageHeader
        eyebrow={selectedHouse ? `Poultry House: ${selectedHouse.name}` : undefined}
        title="Slaughter & Harvest Planning"
        description="Schedule target harvest dates, monitor timelines, and track batch completions."
        actions={
          <button
            type="button"
            className="primary-button"
            onClick={() => navigate("/slaughter-planning/new")}
          >
            <PlusIcon size={14} /> Add Slaughter Plan
          </button>
        }
      />

      <div className="records-section">
        {/* Filter Toolbar */}
        <div className="section-toolbar">
          <div className="filter-chips">
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--text-secondary)",
                marginRight: 4,
              }}
            >
              Status:
            </span>
            <button
              type="button"
              className={`filter-chip ${statusFilter === "all" ? "active" : ""}`}
              onClick={() => setStatusFilter("all")}
            >
              All ({slaughterPlans.length})
            </button>
            <button
              type="button"
              className={`filter-chip chip-danger ${statusFilter === "Overdue" ? "active" : ""}`}
              onClick={() => setStatusFilter("Overdue")}
            >
              Overdue
            </button>
            <button
              type="button"
              className={`filter-chip chip-danger ${statusFilter === "Due today" ? "active" : ""}`}
              onClick={() => setStatusFilter("Due today")}
            >
              Due Today
            </button>
            <button
              type="button"
              className={`filter-chip chip-amber ${statusFilter === "Due soon" ? "active" : ""}`}
              onClick={() => setStatusFilter("Due soon")}
            >
              Due Soon
            </button>
            <button
              type="button"
              className={`filter-chip ${statusFilter === "Upcoming" ? "active" : ""}`}
              onClick={() => setStatusFilter("Upcoming")}
            >
              Upcoming
            </button>
            <button
              type="button"
              className={`filter-chip chip-success ${statusFilter === "Completed" ? "active" : ""}`}
              onClick={() => setStatusFilter("Completed")}
            >
              Completed
            </button>
          </div>

          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {filteredPlans.length} plan{filteredPlans.length === 1 ? "" : "s"} shown
          </div>
        </div>

        {filteredPlans.length === 0 ? (
          <EmptyState
            icon="🗓️"
            title={statusFilter === "all" ? "No slaughter plans scheduled" : "No matching slaughter plans"}
            message={
              statusFilter === "all"
                ? "No harvest dates or slaughter batches have been scheduled for this poultry house."
                : `No slaughter plans found with status "${statusFilter}".`
            }
            actionText={statusFilter !== "all" ? "Show All Plans" : "+ Schedule First Slaughter Plan"}
            onAction={
              statusFilter !== "all"
                ? () => setStatusFilter("all")
                : () => navigate("/slaughter-planning/new")
            }
          />
        ) : (
          <>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Breed</th>
                    <th>Birds Planned</th>
                    <th>Placement Date</th>
                    <th>Expected Slaughter</th>
                    <th>Status</th>
                    <th>Notes</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPlans.map((plan) => {
                    const breedName = plan.breedId
                      ? breedMap.get(plan.breedId) || plan.breed?.name || "Specified Breed"
                      : "Whole House / General Flock";

                    const currentStatus = plan.computedStatus || plan.status || "Upcoming";
                    const isCompleted = plan.status === "Completed";

                    return (
                      <tr key={plan.id}>
                        <td>
                          <span
                            className={plan.breedId ? "breed-chip" : ""}
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: plan.breedId ? "inherit" : "var(--text-muted)",
                            }}
                          >
                            {breedName}
                          </span>
                        </td>
                        <td>
                          <strong>{plan.numberOfBirds}</strong> birds
                        </td>
                        <td>
                          {plan.placementDate
                            ? new Date(plan.placementDate).toLocaleDateString(undefined, {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })
                            : "—"}
                        </td>
                        <td>
                          <div style={{ display: "flex", flexDirection: "column" }}>
                            <strong style={{ fontSize: 13 }}>
                              {new Date(plan.expectedSlaughterDate).toLocaleDateString(undefined, {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })}
                            </strong>
                            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                              Target timeline
                            </span>
                          </div>
                        </td>
                        <td>
                          <span className={getStatusBadgeClass(currentStatus)}>
                            {currentStatus}
                          </span>
                        </td>
                        <td style={{ color: plan.notes ? "var(--text-secondary)" : "var(--text-muted)", maxWidth: 260 }}>
                          {plan.notes || "—"}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div
                            className="record-actions"
                            style={{ justifyContent: "flex-end" }}
                          >
                            <button
                              type="button"
                              className={`status-toggle-btn ${isCompleted ? "reopen" : "complete"}`}
                              onClick={() => toggleSlaughterCompleteHandler(plan)}
                              title={isCompleted ? "Mark as pending" : "Mark as completed"}
                            >
                              {isCompleted ? "Reopen" : "Mark Done"}
                            </button>

                            <button
                              type="button"
                              className="secondary-button"
                              style={{ padding: "4px 10px", fontSize: 12 }}
                              onClick={() => navigate(`/slaughter-planning/${plan.id}/edit`)}
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              className="danger-button"
                              style={{ padding: "4px 10px", fontSize: 12 }}
                              onClick={() =>
                                setConfirmDialog({
                                  type: "slaughter",
                                  id: plan.id,
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
                Total Plans: <strong>{filteredPlans.length}</strong>
              </span>
              <span>
                Total Birds Planned: <strong>{totalBirdsPlanned}</strong> birds
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default SlaughterPlanningPage;
