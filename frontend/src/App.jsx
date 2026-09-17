import { useCallback, useEffect, useState } from "react";

import DailyRecordForm from "./components/DailyRecordForm";
import HouseForm from "./components/HouseForm";
import HouseEditForm from "./components/HouseEditForm";
import DailyRecordEditForm from "./components/DailyRecordEditForm";
import ConfirmDialog from "./components/ConfirmDialog";
import AuthModal from "./components/AuthModal";
import BreedForm from "./components/BreedForm";
import BirdConditionForm from "./components/BirdConditionForm";
import SlaughterPlanForm from "./components/SlaughterPlanForm";

import {
  getHouses,
  getHouseDashboard,
  getDailyRecords,
  deleteHouse,
  deleteDailyRecord,
  getCurrentUser,
  logoutUser,
  getAuthToken,
  getBreeds,
  deleteBreed,
  getBirdConditions,
  deleteBirdCondition,
  getSlaughterPlans,
  deleteSlaughterPlan,
  toggleSlaughterPlanComplete,
} from "./services/api";

import "./App.css";

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [houses, setHouses] = useState([]);
  const [selectedHouse, setSelectedHouse] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [records, setRecords] = useState([]);
  const [breeds, setBreeds] = useState([]);
  const [conditions, setConditions] = useState([]);
  const [slaughterPlans, setSlaughterPlans] = useState([]);

  const [activeTab, setActiveTab] = useState("records"); // "records" | "breeds" | "conditions" | "slaughter"

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Modal / form states
  const [showDailyRecordForm, setShowDailyRecordForm] = useState(false);
  const [showHouseForm, setShowHouseForm] = useState(false);
  const [showHouseEditForm, setShowHouseEditForm] = useState(false);
  const [showBreedForm, setShowBreedForm] = useState(false);
  const [showConditionForm, setShowConditionForm] = useState(false);
  const [showSlaughterForm, setShowSlaughterForm] = useState(false);

  const [editingRecord, setEditingRecord] = useState(null);
  const [editingBreed, setEditingBreed] = useState(null);
  const [editingCondition, setEditingCondition] = useState(null);
  const [editingSlaughter, setEditingSlaughter] = useState(null);

  const [confirmDialog, setConfirmDialog] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const selectedHouseId = selectedHouse?.id;

  // 1. Check authentication status on startup
  useEffect(() => {
    let cancelled = false;

    const checkAuth = async () => {
      const token = getAuthToken();
      if (!token) {
        if (!cancelled) {
          setCurrentUser(null);
          setAuthChecked(true);
          setLoading(false);
        }
        return;
      }

      try {
        const result = await getCurrentUser();
        if (!cancelled) {
          setCurrentUser(result.data);
        }
      } catch {
        if (!cancelled) {
          setCurrentUser(null);
        }
      } finally {
        if (!cancelled) {
          setAuthChecked(true);
        }
      }
    };

    checkAuth();

    return () => {
      cancelled = true;
    };
  }, []);

  // 2. Load all poultry houses for authenticated user
  const loadHouses = useCallback(
    async (preferredHouseId = null) => {
      if (!currentUser) return;

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
          setBreeds([]);
          setConditions([]);
          setSlaughterPlans([]);
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
    [currentUser, selectedHouseId]
  );

  useEffect(() => {
    if (!currentUser || !authChecked) return;

    let cancelled = false;

    queueMicrotask(() => {
      if (!cancelled) {
        loadHouses();
      }
    });

    return () => {
      cancelled = true;
    };
  }, [currentUser, authChecked, loadHouses]);

  // 3. Load dashboard and all related data for selected house
  const loadHouseData = useCallback(async (houseId) => {
    if (!houseId) return;

    try {
      setError("");

      const [dashboardRes, recordsRes, breedsRes, conditionsRes, slaughterRes] =
        await Promise.all([
          getHouseDashboard(houseId),
          getDailyRecords(houseId),
          getBreeds(houseId),
          getBirdConditions(houseId),
          getSlaughterPlans(houseId),
        ]);

      setDashboard(dashboardRes.data);
      setRecords(recordsRes.data);
      setBreeds(breedsRes.data);
      setConditions(conditionsRes.data);
      setSlaughterPlans(slaughterRes.data);
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

  // User auth logout handler
  const handleLogout = () => {
    logoutUser();
    setCurrentUser(null);
    setSelectedHouse(null);
    setHouses([]);
    setDashboard(null);
    setRecords([]);
    setBreeds([]);
    setConditions([]);
    setSlaughterPlans([]);
  };

  const handleAuthSuccess = (user) => {
    setCurrentUser(user);
    setLoading(true);
  };

  // House handlers
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
      setActionLoading(true);
      setError("");
      await deleteHouse(selectedHouse.id);
      await loadHouses();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
      setConfirmDialog(null);
    }
  };

  // Daily Record handlers
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
      setActionLoading(true);
      setError("");
      await deleteDailyRecord(recordId);
      await loadHouseData(selectedHouse.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
      setConfirmDialog(null);
    }
  };

  // Breed handlers
  const handleBreedCreated = async () => {
    setShowBreedForm(false);
    await loadHouseData(selectedHouse.id);
  };

  const handleBreedUpdated = async () => {
    setEditingBreed(null);
    await loadHouseData(selectedHouse.id);
  };

  const handleBreedDeleted = async (breedId) => {
    try {
      setActionLoading(true);
      setError("");
      await deleteBreed(breedId);
      await loadHouseData(selectedHouse.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
      setConfirmDialog(null);
    }
  };

  // Condition handlers
  const handleConditionCreated = async () => {
    setShowConditionForm(false);
    await loadHouseData(selectedHouse.id);
  };

  const handleConditionUpdated = async () => {
    setEditingCondition(null);
    await loadHouseData(selectedHouse.id);
  };

  const handleConditionDeleted = async (conditionId) => {
    try {
      setActionLoading(true);
      setError("");
      await deleteBirdCondition(conditionId);
      await loadHouseData(selectedHouse.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
      setConfirmDialog(null);
    }
  };

  // Slaughter Plan handlers
  const handleSlaughterCreated = async () => {
    setShowSlaughterForm(false);
    await loadHouseData(selectedHouse.id);
  };

  const handleSlaughterUpdated = async () => {
    setEditingSlaughter(null);
    await loadHouseData(selectedHouse.id);
  };

  const handleToggleSlaughterComplete = async (plan) => {
    try {
      setError("");
      await toggleSlaughterPlanComplete(plan.id, plan.status !== "Completed");
      await loadHouseData(selectedHouse.id);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSlaughterDeleted = async (planId) => {
    try {
      setActionLoading(true);
      setError("");
      await deleteSlaughterPlan(planId);
      await loadHouseData(selectedHouse.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
      setConfirmDialog(null);
    }
  };

  // Current bird count calculation
  const currentBirdsInHouse = dashboard?.statistics?.currentBirds ?? selectedHouse?.birdsPlaced ?? 0;

  // Render initial loading screen
  if (!authChecked || (currentUser && loading && houses.length === 0)) {
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

  // Not logged in -> Show Auth modal
  if (!currentUser) {
    return <AuthModal onSuccess={handleAuthSuccess} />;
  }

  // Helper for status badge class
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

  const healthSummary = dashboard?.statistics?.healthSummary || {
    healthy: 0,
    sick: 0,
    weak: 0,
    underObservation: 0,
  };

  const slaughterSummary = dashboard?.statistics?.slaughterSummary || {
    totalBirdsPlanned: 0,
    upcoming: 0,
    dueSoon: 0,
    dueToday: 0,
    overdue: 0,
    completed: 0,
  };

  const urgentSlaughterCount =
    (slaughterSummary.overdue || 0) +
    (slaughterSummary.dueToday || 0) +
    (slaughterSummary.dueSoon || 0);

  return (
    <div className="app">
      {/* Header */}
      <header className="navbar">
        <div>
          <h1>🐔 Poultry Management</h1>
          <p>Farm management dashboard</p>
        </div>

        <div className="navbar-actions">
          {currentUser && (
            <div className="user-profile">
              <span className="user-avatar">👤</span>
              <div className="user-info">
                <strong>{currentUser.name}</strong>
                <span>{currentUser.email}</span>
              </div>
              <button
                type="button"
                className="logout-button"
                onClick={handleLogout}
                title="Sign out of system"
              >
                Sign Out
              </button>
            </div>
          )}

          <button
            type="button"
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

      {/* Main Container */}
      <main className="dashboard">
        {/* Deletion confirmation dialogs */}
        {confirmDialog?.type === "house" && (
          <ConfirmDialog
            title="Delete poultry house?"
            message={`This will permanently delete "${selectedHouse.name}" and all of its daily records, breeds, health logs, and slaughter plans. This action cannot be undone.`}
            onCancel={() => setConfirmDialog(null)}
            onConfirm={handleHouseDeleted}
            loading={actionLoading}
          />
        )}

        {confirmDialog?.type === "record" && (
          <ConfirmDialog
            title="Delete daily record?"
            message="This will permanently delete this daily record. This action cannot be undone."
            onCancel={() => setConfirmDialog(null)}
            onConfirm={() => handleDailyRecordDeleted(confirmDialog.id)}
            loading={actionLoading}
          />
        )}

        {confirmDialog?.type === "breed" && (
          <ConfirmDialog
            title="Delete bird breed?"
            message={`This will remove breed "${confirmDialog.name}" from this poultry house. Any health or slaughter logs referencing this breed will remain.`}
            onCancel={() => setConfirmDialog(null)}
            onConfirm={() => handleBreedDeleted(confirmDialog.id)}
            loading={actionLoading}
          />
        )}

        {confirmDialog?.type === "condition" && (
          <ConfirmDialog
            title="Delete health condition record?"
            message="This will permanently delete this condition record from flock history."
            onCancel={() => setConfirmDialog(null)}
            onConfirm={() => handleConditionDeleted(confirmDialog.id)}
            loading={actionLoading}
          />
        )}

        {confirmDialog?.type === "slaughter" && (
          <ConfirmDialog
            title="Delete slaughter plan?"
            message="This will remove this scheduled slaughter plan from your harvest calendar."
            onCancel={() => setConfirmDialog(null)}
            onConfirm={() => handleSlaughterDeleted(confirmDialog.id)}
            loading={actionLoading}
          />
        )}

        {/* Modal forms */}
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

        {showDailyRecordForm && selectedHouse && (
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

        {showBreedForm && selectedHouse && (
          <BreedForm
            houseId={selectedHouse.id}
            onCancel={() => setShowBreedForm(false)}
            onSuccess={handleBreedCreated}
          />
        )}

        {editingBreed && selectedHouse && (
          <BreedForm
            houseId={selectedHouse.id}
            breed={editingBreed}
            onCancel={() => setEditingBreed(null)}
            onSuccess={handleBreedUpdated}
          />
        )}

        {showConditionForm && selectedHouse && (
          <BirdConditionForm
            houseId={selectedHouse.id}
            breeds={breeds}
            currentBirdsInHouse={currentBirdsInHouse}
            onCancel={() => setShowConditionForm(false)}
            onSuccess={handleConditionCreated}
          />
        )}

        {editingCondition && selectedHouse && (
          <BirdConditionForm
            houseId={selectedHouse.id}
            breeds={breeds}
            currentBirdsInHouse={currentBirdsInHouse}
            condition={editingCondition}
            onCancel={() => setEditingCondition(null)}
            onSuccess={handleConditionUpdated}
          />
        )}

        {showSlaughterForm && selectedHouse && (
          <SlaughterPlanForm
            houseId={selectedHouse.id}
            breeds={breeds}
            currentBirdsInHouse={currentBirdsInHouse}
            onCancel={() => setShowSlaughterForm(false)}
            onSuccess={handleSlaughterCreated}
          />
        )}

        {editingSlaughter && selectedHouse && (
          <SlaughterPlanForm
            houseId={selectedHouse.id}
            breeds={breeds}
            currentBirdsInHouse={currentBirdsInHouse}
            plan={editingSlaughter}
            onCancel={() => setEditingSlaughter(null)}
            onSuccess={handleSlaughterUpdated}
          />
        )}

        {error && <div className="error-message">{error}</div>}

        {!selectedHouse ? (
          <div className="empty-state">
            <h2>No poultry house found</h2>
            <p>You haven't added any poultry houses to your account yet.</p>
            <button
              type="button"
              className="primary-button"
              style={{ marginTop: 16 }}
              onClick={() => setShowHouseForm(true)}
            >
              + Create First Poultry House
            </button>
          </div>
        ) : (
          <>
            {/* Poultry House Top Banner */}
            <section className="welcome">
              <div>
                <span className="section-eyebrow">Poultry House</span>
                <h2>{selectedHouse.name}</h2>
                <p>
                  Manage flock breeds, daily mortality, egg production, health
                  checks, and slaughter schedules.
                </p>
              </div>

              <div className="house-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setShowHouseEditForm(true)}
                >
                  Edit House
                </button>

                <button
                  type="button"
                  className="danger-button"
                  onClick={() =>
                    setConfirmDialog({
                      type: "house",
                    })
                  }
                  disabled={actionLoading}
                >
                  Delete House
                </button>
              </div>
            </section>

            {/* Dashboard Summary Cards */}
            <section className="stats-grid">
              <div className="stat-card">
                <span className="stat-label">Current Birds</span>
                <strong>{dashboard?.statistics?.currentBirds ?? 0}</strong>
                <span className="stat-description">
                  Initial: {selectedHouse.birdsPlaced} birds
                </span>
              </div>

              <div className="stat-card">
                <span className="stat-label">Total Mortality</span>
                <strong>{dashboard?.statistics?.totalMortality ?? 0}</strong>
                <span className="stat-description">
                  {selectedHouse.birdsPlaced
                    ? (
                        ((dashboard?.statistics?.totalMortality ?? 0) /
                          selectedHouse.birdsPlaced) *
                        100
                      ).toFixed(1)
                    : 0}
                  % flock loss
                </span>
              </div>

              <div className="stat-card">
                <span className="stat-label">Feed Used</span>
                <strong>
                  {Number(dashboard?.statistics?.totalFeedUsed ?? 0).toFixed(1)}{" "}
                  kg
                </strong>
                <span className="stat-description">Total feed consumed</span>
              </div>

              <div className="stat-card">
                <span className="stat-label">Eggs Collected</span>
                <strong>{dashboard?.statistics?.totalEggsCollected ?? 0}</strong>
                <span className="stat-description">Total eggs collected</span>
              </div>

              <div className="stat-card">
                <span className="stat-label">Flock Breeds</span>
                <strong>{breeds.length}</strong>
                <span className="stat-description">
                  {dashboard?.statistics?.totalBreedBirds ?? 0} birds cataloged
                </span>
              </div>
            </section>

            {/* Upcoming Slaughter Date Alert Banner (if any due soon/overdue) */}
            {urgentSlaughterCount > 0 && (
              <div className="summary-banner" style={{ borderColor: "#fedf89", background: "#fffdf5" }}>
                <div>
                  <strong style={{ color: "#b54708", display: "block", marginBottom: 4 }}>
                    ⚠️ Harvest Alert: {urgentSlaughterCount} Slaughter Plan(s) Requiring Attention
                  </strong>
                  <span style={{ fontSize: 13, color: "#718078" }}>
                    {slaughterSummary.overdue > 0 && `${slaughterSummary.overdue} overdue, `}
                    {slaughterSummary.dueToday > 0 && `${slaughterSummary.dueToday} due today, `}
                    {slaughterSummary.dueSoon > 0 && `${slaughterSummary.dueSoon} due within 7 days.`}
                  </span>
                </div>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setActiveTab("slaughter")}
                >
                  View Harvest Schedule →
                </button>
              </div>
            )}

            {/* Tab Navigation */}
            <div className="tabs-nav">
              <button
                type="button"
                className={`tab-button ${activeTab === "records" ? "active" : ""}`}
                onClick={() => setActiveTab("records")}
              >
                📅 Daily Records
                <span className="tab-badge">{records.length}</span>
              </button>

              <button
                type="button"
                className={`tab-button ${activeTab === "breeds" ? "active" : ""}`}
                onClick={() => setActiveTab("breeds")}
              >
                🐓 Bird Breeds
                <span className="tab-badge">{breeds.length}</span>
              </button>

              <button
                type="button"
                className={`tab-button ${activeTab === "conditions" ? "active" : ""}`}
                onClick={() => setActiveTab("conditions")}
              >
                🩺 Health & Condition
                <span className="tab-badge">{conditions.length}</span>
              </button>

              <button
                type="button"
                className={`tab-button ${activeTab === "slaughter" ? "active" : ""}`}
                onClick={() => setActiveTab("slaughter")}
              >
                🔪 Slaughter Planning
                <span className="tab-badge">{slaughterPlans.length}</span>
              </button>
            </div>

            {/* TAB 1: DAILY RECORDS */}
            {activeTab === "records" && (
              <section className="records-section">
                <div className="section-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <h2>Daily Production Records</h2>
                    <p>Track mortality, feed usage in kilograms, and eggs collected.</p>
                  </div>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => setShowDailyRecordForm(true)}
                  >
                    + Add Daily Record
                  </button>
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
                            {new Date(record.date).toLocaleDateString(undefined, {
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
                                type="button"
                                className="table-button edit-button"
                                onClick={() => setEditingRecord(record)}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="table-button delete-button"
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

                      {records.length === 0 && (
                        <tr>
                          <td colSpan="5" className="empty-table">
                            No daily records logged yet. Click "+ Add Daily Record" to record today's stats.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="records-footer">
                  <span>Showing {records.length} record(s)</span>
                  <span>{selectedHouse.birdsPlaced} birds initially placed</span>
                </div>
              </section>
            )}

            {/* TAB 2: BIRD BREEDS */}
            {activeTab === "breeds" && (
              <section className="records-section">
                <div className="section-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <h2>Bird Breeds</h2>
                    <p>Record and monitor multiple breeds kept within this poultry house.</p>
                  </div>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => setShowBreedForm(true)}
                  >
                    + Add Breed
                  </button>
                </div>

                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Breed Name</th>
                        <th>Number of Birds</th>
                        <th>Date Added</th>
                        <th>Notes & Purpose</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {breeds.map((breed) => (
                        <tr key={breed.id}>
                          <td>
                            <strong>{breed.name}</strong>
                          </td>
                          <td>
                            <span className="breed-chip">
                              {breed.numberOfBirds} birds
                            </span>
                          </td>
                          <td>
                            {breed.dateAdded
                              ? new Date(breed.dateAdded).toLocaleDateString(undefined, {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                })
                              : "—"}
                          </td>
                          <td style={{ color: breed.description ? "#526058" : "#99a29e" }}>
                            {breed.description || "No notes"}
                          </td>
                          <td>
                            <div className="record-actions">
                              <button
                                type="button"
                                className="table-button edit-button"
                                onClick={() => setEditingBreed(breed)}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="table-button delete-button"
                                onClick={() =>
                                  setConfirmDialog({
                                    type: "breed",
                                    id: breed.id,
                                    name: breed.name,
                                  })
                                }
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}

                      {breeds.length === 0 && (
                        <tr>
                          <td colSpan="5" className="empty-table">
                            No breeds recorded for this poultry house yet. Click "+ Add Breed" to catalog your breeds (e.g. Cobb 500, Ross 308).
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="records-footer">
                  <span>Showing {breeds.length} breed(s)</span>
                  <span>
                    Total:{" "}
                    {breeds.reduce((sum, b) => sum + b.numberOfBirds, 0)} birds across breeds
                  </span>
                </div>
              </section>
            )}

            {/* TAB 3: HEALTH & CONDITION TRACKING */}
            {activeTab === "conditions" && (
              <section className="records-section">
                <div className="section-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <h2>Bird Condition & Health Tracking</h2>
                    <p>Record healthy birds, sick birds, weak birds, and birds under observation.</p>
                  </div>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => setShowConditionForm(true)}
                  >
                    + Record Condition
                  </button>
                </div>

                {/* Health Condition Summary Bar */}
                <div className="summary-banner" style={{ margin: "20px 22px 10px" }}>
                  <div className="summary-metrics">
                    <div className="summary-item">
                      <span className="summary-item-label">Healthy</span>
                      <span className="summary-item-value success">{healthSummary.healthy}</span>
                    </div>
                    <div className="summary-item">
                      <span className="summary-item-label">Sick</span>
                      <span className="summary-item-value warning">{healthSummary.sick}</span>
                    </div>
                    <div className="summary-item">
                      <span className="summary-item-label">Weak</span>
                      <span className="summary-item-value amber">{healthSummary.weak}</span>
                    </div>
                    <div className="summary-item">
                      <span className="summary-item-label">Under Observation</span>
                      <span className="summary-item-value" style={{ color: "#3538cd" }}>
                        {healthSummary.underObservation}
                      </span>
                    </div>
                  </div>
                  <span style={{ fontSize: 13, color: "#718078" }}>
                    Total Checks: {conditions.length} inspection(s)
                  </span>
                </div>

                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Breed / Scope</th>
                        <th>Healthy</th>
                        <th>Sick</th>
                        <th>Weak</th>
                        <th>Observation</th>
                        <th>Total Birds</th>
                        <th>Clinical Notes</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {conditions.map((item) => {
                        const totalCount =
                          item.healthy + item.sick + item.weak + item.underObservation;

                        return (
                          <tr key={item.id}>
                            <td>
                              {new Date(item.recordDate).toLocaleDateString(undefined, {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })}
                            </td>
                            <td>
                              {item.breed ? (
                                <span className="breed-chip">{item.breed.name}</span>
                              ) : (
                                <span style={{ color: "#718078", fontStyle: "italic" }}>
                                  Whole House
                                </span>
                              )}
                            </td>
                            <td>
                              <span className="badge badge-healthy">{item.healthy}</span>
                            </td>
                            <td>
                              {item.sick > 0 ? (
                                <span className="badge badge-sick">{item.sick}</span>
                              ) : (
                                0
                              )}
                            </td>
                            <td>
                              {item.weak > 0 ? (
                                <span className="badge badge-weak">{item.weak}</span>
                              ) : (
                                0
                              )}
                            </td>
                            <td>
                              {item.underObservation > 0 ? (
                                <span className="badge badge-obs">{item.underObservation}</span>
                              ) : (
                                0
                              )}
                            </td>
                            <td>
                              <strong>{totalCount}</strong>
                            </td>
                            <td style={{ maxWidth: 220, color: item.notes ? "#526058" : "#99a29e" }}>
                              {item.notes || "None"}
                            </td>
                            <td>
                              <div className="record-actions">
                                <button
                                  type="button"
                                  className="table-button edit-button"
                                  onClick={() => setEditingCondition(item)}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="table-button delete-button"
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

                      {conditions.length === 0 && (
                        <tr>
                          <td colSpan="9" className="empty-table">
                            No bird condition logs recorded yet. Click "+ Record Condition" to perform a health inspection.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="records-footer">
                  <span>Showing {conditions.length} condition record(s)</span>
                  <span>Flock health tracking active</span>
                </div>
              </section>
            )}

            {/* TAB 4: SLAUGHTER PLANNING */}
            {activeTab === "slaughter" && (
              <section className="records-section">
                <div className="section-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <h2>Expected Slaughter & Harvest Planning</h2>
                    <p>Plan slaughter schedules, track due dates, and monitor harvest completion.</p>
                  </div>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => setShowSlaughterForm(true)}
                  >
                    + Schedule Slaughter
                  </button>
                </div>

                {/* Slaughter Summary Banner */}
                <div className="summary-banner" style={{ margin: "20px 22px 10px" }}>
                  <div className="summary-metrics">
                    <div className="summary-item">
                      <span className="summary-item-label">Total Planned</span>
                      <span className="summary-item-value">{slaughterSummary.totalBirdsPlanned} birds</span>
                    </div>
                    <div className="summary-item">
                      <span className="summary-item-label">Overdue</span>
                      <span className="summary-item-value warning">{slaughterSummary.overdue}</span>
                    </div>
                    <div className="summary-item">
                      <span className="summary-item-label">Due Today</span>
                      <span className="summary-item-value warning">{slaughterSummary.dueToday}</span>
                    </div>
                    <div className="summary-item">
                      <span className="summary-item-label">Due Soon</span>
                      <span className="summary-item-value amber">{slaughterSummary.dueSoon}</span>
                    </div>
                    <div className="summary-item">
                      <span className="summary-item-label">Completed</span>
                      <span className="summary-item-value success">{slaughterSummary.completed}</span>
                    </div>
                  </div>
                </div>

                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Expected Date</th>
                        <th>Status</th>
                        <th>Breed / Scope</th>
                        <th>Quantity</th>
                        <th>Placement Date</th>
                        <th>Market Notes</th>
                        <th>Harvest Action</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {slaughterPlans.map((plan) => (
                        <tr key={plan.id}>
                          <td>
                            <strong>
                              {new Date(plan.expectedSlaughterDate).toLocaleDateString(
                                undefined,
                                {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                }
                              )}
                            </strong>
                          </td>
                          <td>
                            <span className={getStatusBadgeClass(plan.computedStatus)}>
                              {plan.computedStatus}
                            </span>
                          </td>
                          <td>
                            {plan.breed ? (
                              <span className="breed-chip">{plan.breed.name}</span>
                            ) : (
                              <span style={{ color: "#718078", fontStyle: "italic" }}>
                                Whole House
                              </span>
                            )}
                          </td>
                          <td>
                            <strong>{plan.numberOfBirds}</strong> birds
                          </td>
                          <td>
                            {new Date(plan.placementDate).toLocaleDateString(undefined, {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </td>
                          <td style={{ maxWidth: 200, color: plan.notes ? "#526058" : "#99a29e" }}>
                            {plan.notes || "None"}
                          </td>
                          <td>
                            <button
                              type="button"
                              className={`status-toggle-btn ${
                                plan.status === "Completed" ? "reopen" : "complete"
                              }`}
                              onClick={() => handleToggleSlaughterComplete(plan)}
                            >
                              {plan.status === "Completed"
                                ? "↺ Mark Pending"
                                : "✓ Mark Completed"}
                            </button>
                          </td>
                          <td>
                            <div className="record-actions">
                              <button
                                type="button"
                                className="table-button edit-button"
                                onClick={() => setEditingSlaughter(plan)}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="table-button delete-button"
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
                      ))}

                      {slaughterPlans.length === 0 && (
                        <tr>
                          <td colSpan="8" className="empty-table">
                            No slaughter plans scheduled yet. Click "+ Schedule Slaughter" to set harvest dates.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="records-footer">
                  <span>Showing {slaughterPlans.length} slaughter plan(s)</span>
                  <span>
                    Total:{" "}
                    {slaughterPlans.reduce((acc, p) => acc + p.numberOfBirds, 0)} birds planned for slaughter
                  </span>
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default App;