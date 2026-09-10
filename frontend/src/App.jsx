import { useCallback, useEffect, useState } from "react";

import DailyRecordForm from "./components/DailyRecordForm";
import HouseForm from "./components/HouseForm";
import HouseEditForm from "./components/HouseEditForm";
import DailyRecordEditForm from "./components/DailyRecordEditForm";
import ConfirmDialog from "./components/ConfirmDialog";

import {
  getHouses,
  getHouseDashboard,
  getDailyRecords,
  deleteHouse,
  deleteDailyRecord,
} from "./services/api";

import "./App.css";

function App() {
  const [houses, setHouses] = useState([]);
  const [selectedHouse, setSelectedHouse] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [records, setRecords] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showDailyRecordForm, setShowDailyRecordForm] = useState(false);
  const [showHouseForm, setShowHouseForm] = useState(false);
  const [showHouseEditForm, setShowHouseEditForm] = useState(false);

  const [editingRecord, setEditingRecord] = useState(null);

  const [deletingHouse, setDeletingHouse] = useState(false);
  const [deletingRecordId, setDeletingRecordId] = useState(null);

  const [confirmDialog, setConfirmDialog] = useState(null);
  const selectedHouseId = selectedHouse?.id;

 // Load all poultry houses
const loadHouses = useCallback(
  async (preferredHouseId = null) => {
    try {
      setLoading(true);
      setError("");

      const result = await getHouses();

      const houseList = result.data;

      setHouses(houseList);

      if (houseList.length === 0) {
        setSelectedHouse(null);
        setDashboard(null);
        setRecords([]);
        return;
      }

      const houseToSelect =
        houseList.find((house) => house.id === preferredHouseId) ||
        houseList.find((house) => house.id === selectedHouseId) ||
        houseList[0];

      setSelectedHouse(houseToSelect);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  },
  [selectedHouseId]
);

useEffect(() => {
  let cancelled = false;

  queueMicrotask(() => {
    if (!cancelled) {
      loadHouses();
    }
  });

  return () => {
    cancelled = true;
  };
}, [loadHouses]);

  // Load dashboard and records for selected house
  const loadHouseData = useCallback(async (houseId) => {
    try {
      setError("");

      const [dashboardResult, recordsResult] = await Promise.all([
        getHouseDashboard(houseId),
        getDailyRecords(),
      ]);

      setDashboard(dashboardResult.data);

      const houseRecords = recordsResult.data.filter(
        (record) => record.houseId === houseId
      );

      setRecords(houseRecords);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    if (!selectedHouse) {
      return;
    }

    let cancelled = false;

    queueMicrotask(() => {
      if (!cancelled) {
        loadHouseData(selectedHouse.id);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [selectedHouse, loadHouseData]);

  const handleHouseCreated = async (newHouse) => {
    setShowHouseForm(false);

    await loadHouses(newHouse.id);
  };

  const handleHouseUpdated = async (updatedHouse) => {
    setShowHouseEditForm(false);

    await loadHouses(updatedHouse.id);
  };

  const handleHouseDeleted = async () => {
    try {
      setDeletingHouse(true);
      setError("");

      await deleteHouse(selectedHouse.id);

      await loadHouses();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingHouse(false);
      setConfirmDialog(null);
    }
  };

  const handleDailyRecordCreated = async () => {
    setShowDailyRecordForm(false);

    await loadHouseData(selectedHouse.id);
  };

  const handleDailyRecordUpdated = async () => {
    setEditingRecord(null);

    await loadHouseData(selectedHouse.id);
  };

  const handleDailyRecordDeleted = async (recordId) => {
    try {
      setDeletingRecordId(recordId);
      setError("");

      await deleteDailyRecord(recordId);

      await loadHouseData(selectedHouse.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingRecordId(null);
    }
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-content">
          <div className="loading-spinner"></div>

          <h2>Loading Poultry Management</h2>

          <p>Preparing your farm dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="navbar">
        <div>
          <h1>Poultry Management</h1>
          <p>Farm management dashboard</p>
        </div>

        <div className="navbar-actions">
          <button
            className="primary-button"
            onClick={() => setShowHouseForm(true)}
          >
            + Add Poultry House
          </button>

          {houses.length > 0 && (
            <div className="house-selector">
              <label htmlFor="house">Poultry House</label>

              <select
                id="house"
                value={selectedHouse?.id || ""}
                onChange={(event) => {
                  const house = houses.find(
                    (item) => item.id === Number(event.target.value)
                  );

                  setSelectedHouse(house);
                }}
              >
                {houses.map((house) => (
                  <option key={house.id} value={house.id}>
                    {house.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </header>

      <main className="dashboard">
        {confirmDialog?.type === "house" && (
          <ConfirmDialog
            title="Delete poultry house?"
            onCancel={() => setConfirmDialog(null)}
            message={`This will permanently delete "${selectedHouse.name}" and all of its daily records. This action cannot be undone.`}
            onConfirm={async () => {
              setConfirmDialog(null);
              await handleHouseDeleted();
            }}
            loading={deletingHouse}
          />
        )}

        {confirmDialog?.type === "record" && (
          <ConfirmDialog
            title="Delete daily record?"
            onCancel={() => setConfirmDialog(null)}
            message="This will permanently delete this daily record. This action cannot be undone."
            onConfirm={async () => {
              const recordId = confirmDialog.recordId;

              setConfirmDialog(null);
              await handleDailyRecordDeleted(recordId);
            }}
            loading={deletingRecordId !== null}
          />
        )}

        {showHouseForm && (
          <HouseForm
            onCancel={() => setShowHouseForm(false)}
            onSuccess={handleHouseCreated}
          />
        )}

        {showHouseEditForm && selectedHouse && (
          <HouseEditForm
            house={selectedHouse}
            onCancel={() => setShowHouseEditForm(false)}
            onSuccess={handleHouseUpdated}
          />
        )}

        {error && <div className="error-message">{error}</div>}

        {!selectedHouse ? (
          <div className="empty-state">
            <h2>No poultry house found</h2>
            <p>Create your first poultry house to get started.</p>
          </div>
        ) : (
          <>
            <section className="welcome">
              <div>
                <span className="section-eyebrow">Poultry House</span>

                <h2>{selectedHouse.name}</h2>

                <p>
                  Manage your birds, mortality, feed usage and egg
                  production.
                </p>
              </div>

              <div className="house-actions">
                <button
                  className="secondary-button"
                  onClick={() => setShowHouseEditForm(true)}
                >
                  Edit House
                </button>

                <button
                  className="danger-button"
                  onClick={() =>
                    setConfirmDialog({
                      type: "house",
                    })
                  }
                  disabled={deletingHouse}
                >
                  {deletingHouse ? "Deleting..." : "Delete House"}
                </button>

                <button
                  className="primary-button"
                  onClick={() => setShowDailyRecordForm(true)}
                >
                  + Add Daily Record
                </button>
              </div>
            </section>

            {showDailyRecordForm && (
              <DailyRecordForm
                houseId={selectedHouse.id}
                onCancel={() => setShowDailyRecordForm(false)}
                onSuccess={handleDailyRecordCreated}
              />
            )}

            {editingRecord && (
              <DailyRecordEditForm
                record={editingRecord}
                onCancel={() => setEditingRecord(null)}
                onSuccess={handleDailyRecordUpdated}
              />
            )}

            <section className="stats-grid">
              <div className="stat-card">
                <span className="stat-label">Current Birds</span>

                <strong>
                  {dashboard?.statistics.currentBirds ?? 0}
                </strong>

                <span className="stat-description">
                  Birds currently in the house
                </span>
              </div>

              <div className="stat-card">
                <span className="stat-label">Total Mortality</span>

                <strong>
                  {dashboard?.statistics.totalMortality ?? 0}
                </strong>

                <span className="stat-description">
                  Total birds lost
                </span>
              </div>

              <div className="stat-card">
                <span className="stat-label">Feed Used</span>

                <strong>
                  {Number(
                    dashboard?.statistics.totalFeedUsed ?? 0
                  ).toFixed(1)}{" "}
                  kg
                </strong>

                <span className="stat-description">
                  Total feed consumed
                </span>
              </div>

              <div className="stat-card">
                <span className="stat-label">Eggs Collected</span>

                <strong>
                  {dashboard?.statistics.totalEggsCollected ?? 0}
                </strong>

                <span className="stat-description">
                  Total eggs collected
                </span>
              </div>

              <div className="stat-card">
                <span className="stat-label">Daily Records</span>

                <strong>{records.length}</strong>

                <span className="stat-description">
                  Records recorded for this house
                </span>
              </div>
            </section>

            <section className="records-section">
              <div className="section-header">
                <div>
                  <h2>Daily Records</h2>

                  <p>
                    {records.length}{" "}
                    {records.length === 1 ? "record" : "records"} recorded
                    for this poultry house.
                  </p>
                </div>
              </div>

              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Mortality</th>
                      <th>Feed Used</th>
                      <th>Eggs Collected</th>
                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {records.map((record) => (
                      <tr key={record.id}>
                        <td>
                          {new Date(
                            record.date
                          ).toLocaleDateString(undefined, {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>

                        <td>{record.mortality}</td>

                        <td>{Number(record.feedUsedKg).toFixed(1)} kg</td>

                        <td>{record.eggsCollected}</td>

                        <td>
                          <div className="record-actions">
                            <button
                              className="table-button edit-button"
                              onClick={() =>
                                setEditingRecord(record)
                              }
                            >
                              Edit
                            </button>

                            <button
                              className="table-button delete-button"
                              disabled={
                                deletingRecordId === record.id
                              }
                              onClick={() =>
                                setConfirmDialog({
                                  type: "record",
                                  recordId: record.id,
                                })
                              }
                            >
                              {deletingRecordId === record.id
                                ? "Deleting..."
                                : "Delete"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {records.length === 0 && (
                      <tr>
                        <td colSpan="5" className="empty-table">
                          No daily records yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="records-footer">
                <span>
                  Showing {records.length}{" "}
                  {records.length === 1 ? "record" : "records"}
                </span>

                <span>
                  {selectedHouse.birdsPlaced} birds initially placed
                </span>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

export default App;