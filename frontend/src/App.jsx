import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { FarmProvider } from "./context/FarmContext";
import { useFarm } from "./context/useFarm";
import AppLayout from "./components/AppLayout";
import AuthModal from "./components/AuthModal";
import HouseRouteSync from "./components/HouseRouteSync";

// Feature Pages
import DashboardPage from "./pages/DashboardPage";
import DailyRecordsPage from "./pages/DailyRecordsPage";
import DailyRecordFormPage from "./pages/DailyRecordFormPage";
import BreedsPage from "./pages/BreedsPage";
import BreedFormPage from "./pages/BreedFormPage";
import HealthConditionPage from "./pages/HealthConditionPage";
import HealthConditionFormPage from "./pages/HealthConditionFormPage";
import SlaughterPlanningPage from "./pages/SlaughterPlanningPage";
import SlaughterPlanFormPage from "./pages/SlaughterPlanFormPage";
import HouseFormPage from "./pages/HouseFormPage";
import FinancePage from "./pages/FinancePage";
import InventoryPage from "./pages/InventoryPage";
import FlocksPage from "./pages/FlocksPage";
import FlockFormPage from "./pages/FlockFormPage";
import FlockDetailPage from "./pages/FlockDetailPage";
import VaccinationsPage from "./pages/VaccinationsPage";
import DepopulationPage from "./pages/DepopulationPage";
import EggsPage from "./pages/EggsPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";

import "./App.css";

function AppContent() {
  const { currentUser, authChecked, handleAuthSuccess, loading, houses } =
    useFarm();

  // Initial authentication & startup loading screen
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

  // Not logged in -> public reset-password page stays reachable (email link),
  // everything else shows the auth modal.
  if (!currentUser) {
    return (
      <Routes>
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="*" element={<AuthModal onSuccess={handleAuthSuccess} />} />
      </Routes>
    );
  }

  return (
    <Routes>
      {/* Public: email reset link works whether or not the user is signed in */}
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route element={<AppLayout />}>
        {/* Default Landing */}
        <Route index element={<Navigate to="/dashboard" replace />} />

        {/* 1. Dashboard */}
        <Route path="/dashboard" element={<DashboardPage />} />

        {/* 2. Flocks / Batches */}
        <Route path="/flocks" element={<FlocksPage />} />
        <Route path="/flocks/new" element={<FlockFormPage />} />
        <Route path="/flocks/:id" element={<FlockDetailPage />} />
        <Route path="/flocks/:id/edit" element={<FlockFormPage />} />
        <Route path="/depopulation" element={<DepopulationPage />} />
        <Route path="/depopulation-events" element={<DepopulationPage />} />

        {/* 3. Daily Records */}
        <Route path="/daily-records" element={<DailyRecordsPage />} />
        <Route path="/daily-records/new" element={<DailyRecordFormPage />} />
        <Route path="/daily-records/:id/edit" element={<DailyRecordFormPage />} />

        {/* 4. Vaccinations */}
        <Route path="/vaccinations" element={<VaccinationsPage />} />

        {/* 5. Bird Breeds */}
        <Route path="/breeds" element={<BreedsPage />} />
        <Route path="/breeds/new" element={<BreedFormPage />} />
        <Route path="/breeds/:id/edit" element={<BreedFormPage />} />

        {/* 6. Health & Condition */}
        <Route path="/health-condition" element={<HealthConditionPage />} />
        <Route path="/health-condition/new" element={<HealthConditionFormPage />} />
        <Route path="/health-condition/:id/edit" element={<HealthConditionFormPage />} />

        {/* 7. Slaughter Planning */}
        <Route path="/slaughter-planning" element={<SlaughterPlanningPage />} />
        <Route path="/slaughter-planning/new" element={<SlaughterPlanFormPage />} />
        <Route path="/slaughter-planning/:id/edit" element={<SlaughterPlanFormPage />} />

        {/* 8. Inventory & Feed Management */}
        <Route path="/inventory" element={<InventoryPage />} />

        {/* 8b. Egg Inventory & Sales */}
        <Route path="/eggs" element={<EggsPage />} />

        {/* 9. Financial Management */}
        <Route path="/finances" element={<FinancePage />} />

        {/* Poultry House Management */}
        <Route path="/houses/new" element={<HouseFormPage />} />
        <Route path="/houses/:id/edit" element={<HouseFormPage />} />

        {/* Scoped House routes: /houses/:houseId/... */}
        <Route path="/houses/:houseId" element={<HouseRouteSync />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="flocks" element={<FlocksPage />} />
          <Route path="flocks/:id" element={<FlockDetailPage />} />
          <Route path="depopulation" element={<DepopulationPage />} />
          <Route path="depopulation-events" element={<DepopulationPage />} />
          <Route path="daily-records" element={<DailyRecordsPage />} />
          <Route path="vaccinations" element={<VaccinationsPage />} />
          <Route path="breeds" element={<BreedsPage />} />
          <Route path="health-condition" element={<HealthConditionPage />} />
          <Route path="slaughter-planning" element={<SlaughterPlanningPage />} />
          <Route path="inventory" element={<InventoryPage />} />
          <Route path="eggs" element={<EggsPage />} />
          <Route path="finances" element={<FinancePage />} />
        </Route>

        {/* Fallback to Dashboard */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <FarmProvider>
        <AppContent />
      </FarmProvider>
    </BrowserRouter>
  );
}

export default App;