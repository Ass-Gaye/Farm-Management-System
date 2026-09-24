import { useState } from "react";
import { Outlet, useNavigate, Link, useLocation } from "react-router-dom";
import { useFarm } from "../context/useFarm";
import PageNavigation from "./common/PageNavigation";
import ConfirmDialog from "./ConfirmDialog";
import EmptyState from "./common/EmptyState";
import ProfileModal from "./ProfileModal";
import { PlusIcon } from "./Icons";

function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showProfileModal, setShowProfileModal] = useState(false);
  const {
    currentUser,
    setCurrentUser,
    handleLogout,
    houses,
    selectedHouse,
    selectHouse,
    error,
    toast,
    showToast,
    closeToast,
    confirmDialog,
    setConfirmDialog,
    actionLoading,
    deleteHouseHandler,
    deleteRecordHandler,
    deleteBreedHandler,
    deleteConditionHandler,
    deleteSlaughterHandler,
    deleteFlockHandler,
    deleteVaccinationHandler,
  } = useFarm();

  // Check if current route is a dedicated full-screen form page
  const isFormPage =
    location.pathname.endsWith("/new") || location.pathname.endsWith("/edit");

  return (
    <div className="app">
      {/* Top Application Header */}
      <header className="navbar">
        <Link to="/dashboard" className="navbar-brand-link" style={{ textDecoration: "none", color: "inherit" }}>
          <div>
            <h1>🐔 Poultry Management</h1>
            <p>Farm operations dashboard</p>
          </div>
        </Link>

        <div className="navbar-actions">
          {currentUser && (
            <div className="user-profile">
              <button
                type="button"
                className="user-profile-trigger"
                onClick={() => setShowProfileModal(true)}
                title="Account settings & change password"
                aria-label={`Open account settings for ${currentUser.name}`}
              >
                <span className="user-avatar" aria-hidden="true">👤</span>
                <span className="user-info">
                  <strong>{currentUser.name}</strong>
                </span>
              </button>
              <button
                type="button"
                className="secondary-button"
                style={{ padding: "4px 8px", fontSize: 11 }}
                onClick={() => setShowProfileModal(true)}
                title="Account settings & change password"
              >
                ⚙️ Settings
              </button>
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
            onClick={() => navigate("/houses/new")}
            title="Create a new poultry house"
          >
            <PlusIcon size={14} /> Add Poultry House
          </button>

          {houses.length > 0 && (
            <div className="house-selector">
              <label htmlFor="active-house-select">Poultry House</label>
              <select
                id="active-house-select"
                value={selectedHouse?.id || ""}
                onChange={(event) => {
                  selectHouse(Number(event.target.value));
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

      {/* Main Page Content Area */}
      <main className="dashboard">
        {/* Global Confirmation Dialogs */}
        {confirmDialog?.type === "house" && (
          <ConfirmDialog
            title="Delete poultry house?"
            message={`This will permanently delete "${selectedHouse?.name}" and all of its daily records, breeds, health logs, and slaughter plans. This action cannot be undone.`}
            onCancel={() => setConfirmDialog(null)}
            onConfirm={() => deleteHouseHandler(selectedHouse.id)}
            loading={actionLoading}
          />
        )}

        {confirmDialog?.type === "record" && (
          <ConfirmDialog
            title="Delete daily record?"
            message="This will permanently delete this daily record. This action cannot be undone."
            onCancel={() => setConfirmDialog(null)}
            onConfirm={() => deleteRecordHandler(confirmDialog.id)}
            loading={actionLoading}
          />
        )}

        {confirmDialog?.type === "breed" && (
          <ConfirmDialog
            title="Delete bird breed?"
            message={`This will remove breed "${confirmDialog.name}" from this poultry house. Any health or slaughter logs referencing this breed will remain.`}
            onCancel={() => setConfirmDialog(null)}
            onConfirm={() => deleteBreedHandler(confirmDialog.id)}
            loading={actionLoading}
          />
        )}

        {confirmDialog?.type === "condition" && (
          <ConfirmDialog
            title="Delete health condition record?"
            message="This will permanently delete this condition record from flock history."
            onCancel={() => setConfirmDialog(null)}
            onConfirm={() => deleteConditionHandler(confirmDialog.id)}
            loading={actionLoading}
          />
        )}

        {confirmDialog?.type === "slaughter" && (
          <ConfirmDialog
            title="Delete slaughter plan?"
            message="This will remove this scheduled slaughter plan from your harvest calendar."
            onCancel={() => setConfirmDialog(null)}
            onConfirm={() => deleteSlaughterHandler(confirmDialog.id)}
            loading={actionLoading}
          />
        )}

        {confirmDialog?.type === "flock" && (
          <ConfirmDialog
            title="Delete flock batch?"
            message={`This will permanently delete flock batch "${confirmDialog.name}". Any related daily production or vaccination entries will be updated.`}
            onCancel={() => setConfirmDialog(null)}
            onConfirm={() => deleteFlockHandler(confirmDialog.id)}
            loading={actionLoading}
          />
        )}

        {confirmDialog?.type === "vaccination" && (
          <ConfirmDialog
            title="Delete vaccination record?"
            message="This will remove this vaccination schedule entry."
            onCancel={() => setConfirmDialog(null)}
            onConfirm={() => deleteVaccinationHandler(confirmDialog.id)}
            loading={actionLoading}
          />
        )}

        {/* Global Error Banner */}
        {error && <div className="error-message">{error}</div>}

        {/* If no houses exist and not on house creation page */}
        {houses.length === 0 && !location.pathname.startsWith("/houses") ? (
          <EmptyState
            icon="🏠"
            title="No poultry house found"
            message="You haven't added any poultry houses to your account yet. Create your first poultry house to start tracking flock operations."
            actionText="+ Create First Poultry House"
            onAction={() => navigate("/houses/new")}
          />
        ) : (
          <>
            {/* When on a feature page (not a dedicated form page), show the tabs navigation */}
            {!isFormPage && <PageNavigation />}

            {/* Render the current page */}
            <Outlet />
          </>
        )}
      </main>

      {/* User Account & Password Modal */}
      <ProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        user={currentUser}
        onProfileUpdated={(updated) => setCurrentUser(updated)}
        showToast={showToast}
      />

      {/* Global Toast Notification */}
      {toast && (
        <div className="toast-container" role="status" aria-live="polite">
          <div className={`toast toast-${toast.type}`}>
            <span>{toast.message}</span>
            <button
              type="button"
              className="toast-close"
              onClick={closeToast}
              aria-label="Close notification"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default AppLayout;
