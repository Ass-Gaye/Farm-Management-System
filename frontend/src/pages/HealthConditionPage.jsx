import { useNavigate } from "react-router-dom";
import { useFarm } from "../context/useFarm";
import PageHeader from "../components/common/PageHeader";
import EmptyState from "../components/common/EmptyState";
import { PlusIcon } from "../components/Icons";

function HealthConditionPage() {
  const navigate = useNavigate();
  const { conditions, breeds, selectedHouse, setConfirmDialog } = useFarm();

  const breedMap = new Map(breeds.map((b) => [b.id, b.name]));

  return (
    <div className="health-condition-page">
      <PageHeader
        eyebrow={selectedHouse ? `Poultry House: ${selectedHouse.name}` : undefined}
        title="Flock Health & Condition"
        description="Monitor bird vitality and track healthy, sick, weak, and observation status records."
        actions={
          <button
            type="button"
            className="primary-button"
            onClick={() => navigate("/health-condition/new")}
          >
            <PlusIcon size={14} /> Add Health Record
          </button>
        }
      />

      <div className="records-section">
        <div className="section-toolbar">
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
            Flock Inspection Logs
          </span>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {conditions.length} inspection record{conditions.length === 1 ? "" : "s"}
          </span>
        </div>

        {conditions.length === 0 ? (
          <EmptyState
            icon="🩺"
            title="No health records logged"
            message="No health inspections or bird condition assessments have been recorded for this poultry house yet."
            actionText="+ Record First Health Check"
            onAction={() => navigate("/health-condition/new")}
          />
        ) : (
          <>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Date Recorded</th>
                    <th>Breed</th>
                    <th>Healthy</th>
                    <th>Sick</th>
                    <th>Weak</th>
                    <th>Observation</th>
                    <th>Total Inspected</th>
                    <th>Notes</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {conditions.map((item) => {
                    const breedName = item.breedId
                      ? breedMap.get(item.breedId) || item.breed?.name || "Specified Breed"
                      : "Whole House / General Flock";

                    const totalCount =
                      (item.healthy || 0) +
                      (item.sick || 0) +
                      (item.weak || 0) +
                      (item.underObservation || 0);

                    return (
                      <tr key={item.id}>
                        <td style={{ fontWeight: 600 }}>
                          {item.recordDate
                            ? new Date(item.recordDate).toLocaleDateString(undefined, {
                                weekday: "short",
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })
                            : "—"}
                        </td>
                        <td>
                          <span
                            className={item.breedId ? "breed-chip" : ""}
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: item.breedId ? "inherit" : "var(--text-muted)",
                            }}
                          >
                            {breedName}
                          </span>
                        </td>
                        <td>
                          <span className="badge badge-healthy">
                            {item.healthy || 0} healthy
                          </span>
                        </td>
                        <td>
                          {item.sick > 0 ? (
                            <span className="badge badge-sick">
                              {item.sick} sick
                            </span>
                          ) : (
                            <span style={{ color: "var(--text-muted)", fontSize: 12 }}>0</span>
                          )}
                        </td>
                        <td>
                          {item.weak > 0 ? (
                            <span className="badge badge-weak">
                              {item.weak} weak
                            </span>
                          ) : (
                            <span style={{ color: "var(--text-muted)", fontSize: 12 }}>0</span>
                          )}
                        </td>
                        <td>
                          {item.underObservation > 0 ? (
                            <span className="badge badge-obs">
                              {item.underObservation} obs
                            </span>
                          ) : (
                            <span style={{ color: "var(--text-muted)", fontSize: 12 }}>0</span>
                          )}
                        </td>
                        <td>
                          <strong>{totalCount}</strong> birds
                        </td>
                        <td style={{ color: item.notes ? "var(--text-secondary)" : "var(--text-muted)", maxWidth: 280 }}>
                          {item.notes || "—"}
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
                              onClick={() => navigate(`/health-condition/${item.id}/edit`)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="danger-button"
                              style={{ padding: "4px 10px", fontSize: 12 }}
                              onClick={() =>
                                setConfirmDialog({
                                  type: "condition",
                                  id: item.id,
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
                Total Health Checks: <strong>{conditions.length}</strong>
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default HealthConditionPage;
