import { useCallback, useEffect, useState } from "react";
import { FarmContext } from "./farmContextDef";
import {
  getCurrentUser,
  logoutUser,
  getAuthToken,
  getHouses,
  getHouseDashboard,
  getDailyRecords,
  getBreeds,
  getBirdConditions,
  getSlaughterPlans,
  getFlocks,
  getVaccinations,
  deleteHouse,
  deleteDailyRecord,
  deleteBreed,
  deleteBirdCondition,
  deleteSlaughterPlan,
  deleteFlock,
  deleteVaccination,
  toggleSlaughterPlanComplete,
} from "../services/api";

const SELECTED_HOUSE_KEY = "poultry_mgmt_selected_house_id";

export function FarmProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [houses, setHouses] = useState([]);
  const [selectedHouse, setSelectedHouse] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [records, setRecords] = useState([]);
  const [breeds, setBreeds] = useState([]);
  const [conditions, setConditions] = useState([]);
  const [slaughterPlans, setSlaughterPlans] = useState([]);
  const [flocks, setFlocks] = useState([]);
  const [vaccinations, setVaccinations] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);

  const [confirmDialog, setConfirmDialog] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Feed/inventory/finance freshness signal. Bumped after any mutation
  // that affects stock (daily consumption, purchases, adjustments) so
  // pages like InventoryPage refetch instead of showing stale snapshots.
  const [feedInventoryVersion, setFeedInventoryVersion] = useState(0);
  const notifyFeedInventoryChanged = useCallback(() => {
    setFeedInventoryVersion((v) => v + 1);
  }, []);

  // Egg inventory freshness signal (pieces). Bumped after any mutation
  // that affects egg stock (daily collection, sales, adjustments,
  // corrections) so the Eggs page refetches instead of showing stale data.
  const [eggInventoryVersion, setEggInventoryVersion] = useState(0);
  const notifyEggInventoryChanged = useCallback(() => {
    setEggInventoryVersion((v) => v + 1);
  }, []);

  const selectedHouseId = selectedHouse?.id;

  // Toast notification
  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type });
  }, []);

  const closeToast = useCallback(() => {
    setToast(null);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast(null);
    }, 3500);
    return () => clearTimeout(timer);
  }, [toast]);

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

  // 2. Load house details and all related data
  const loadHouseData = useCallback(async (houseId) => {
    if (!houseId) return;

    try {
      setError("");
      const [
        dashboardRes,
        recordsRes,
        breedsRes,
        conditionsRes,
        slaughterRes,
        flocksRes,
        vaccinationsRes,
      ] = await Promise.all([
        getHouseDashboard(houseId),
        getDailyRecords(houseId),
        getBreeds(houseId),
        getBirdConditions(houseId),
        getSlaughterPlans(houseId),
        getFlocks(houseId),
        getVaccinations(),
      ]);

      setDashboard(dashboardRes.data);
      setRecords(recordsRes.data || []);
      setBreeds(breedsRes.data || []);
      setConditions(conditionsRes.data || []);
      setSlaughterPlans(slaughterRes.data || []);
      setFlocks(flocksRes.data || []);
      setVaccinations(vaccinationsRes.data || []);
    } catch (err) {
      setError(err.message || "Failed to load farm house data.");
    }
  }, []);

  // 3. Load all houses for current user
  const loadHouses = useCallback(
    async (preferredHouseId = null) => {
      if (!currentUser) return;

      try {
        setLoading(true);
        setError("");

        const result = await getHouses();
        const houseList = result.data || [];

        setHouses(houseList);

        if (houseList.length === 0) {
          setSelectedHouse(null);
          setDashboard(null);
          setRecords([]);
          setBreeds([]);
          setConditions([]);
          setSlaughterPlans([]);
          setFlocks([]);
          setVaccinations([]);
          localStorage.removeItem(SELECTED_HOUSE_KEY);
          return;
        }

        const savedHouseId = localStorage.getItem(SELECTED_HOUSE_KEY);
        const targetId =
          preferredHouseId ||
          (savedHouseId ? Number(savedHouseId) : null) ||
          selectedHouseId;

        const houseToSelect =
          houseList.find((house) => house.id === targetId) || houseList[0];

        setSelectedHouse(houseToSelect);
        localStorage.setItem(SELECTED_HOUSE_KEY, String(houseToSelect.id));
      } catch (err) {
        setError(err.message || "Failed to retrieve poultry houses.");
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

  // Load house data whenever selectedHouse changes
  useEffect(() => {
    if (!selectedHouseId) {
      return;
    }

    let cancelled = false;

    queueMicrotask(() => {
      if (!cancelled) {
        loadHouseData(selectedHouseId);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [selectedHouseId, loadHouseData]);

  // Select house by object or id
  const selectHouse = useCallback(
    (houseOrId) => {
      if (!houseOrId) return;
      const targetId =
        typeof houseOrId === "object" ? houseOrId.id : Number(houseOrId);
      const targetHouse = houses.find((h) => h.id === targetId);
      if (targetHouse) {
        setSelectedHouse(targetHouse);
        localStorage.setItem(SELECTED_HOUSE_KEY, String(targetHouse.id));
      }
    },
    [houses]
  );

  // Reload current house data
  const reloadHouseData = useCallback(async () => {
    if (selectedHouse) {
      await loadHouseData(selectedHouse.id);
    }
  }, [selectedHouse, loadHouseData]);

  // Logout handler
  const handleLogout = useCallback(() => {
    logoutUser();
    setCurrentUser(null);
    setSelectedHouse(null);
    setHouses([]);
    setDashboard(null);
    setRecords([]);
    setBreeds([]);
    setConditions([]);
    setSlaughterPlans([]);
    localStorage.removeItem(SELECTED_HOUSE_KEY);
  }, []);

  const handleAuthSuccess = useCallback((user) => {
    setCurrentUser(user);
    setLoading(true);
  }, []);

  // Delete House
  const deleteHouseHandler = useCallback(
    async (houseId) => {
      try {
        setActionLoading(true);
        setError("");
        await deleteHouse(houseId);
        await loadHouses();
        showToast("Poultry house deleted.");
      } catch (err) {
        setError(err.message || "Failed to delete poultry house.");
      } finally {
        setActionLoading(false);
        setConfirmDialog(null);
      }
    },
    [loadHouses, showToast]
  );

  // Delete Daily Record
  const deleteRecordHandler = useCallback(
    async (recordId) => {
      try {
        setActionLoading(true);
        setError("");
        await deleteDailyRecord(recordId);
        await reloadHouseData();
        notifyFeedInventoryChanged();
        notifyEggInventoryChanged();
        showToast("Daily production record deleted.");
      } catch (err) {
        setError(err.message || "Failed to delete daily record.");
      } finally {
        setActionLoading(false);
        setConfirmDialog(null);
      }
    },
    [reloadHouseData, notifyFeedInventoryChanged, notifyEggInventoryChanged, showToast]
  );

  // Delete Breed
  const deleteBreedHandler = useCallback(
    async (breedId) => {
      try {
        setActionLoading(true);
        setError("");
        await deleteBreed(breedId);
        await reloadHouseData();
        showToast("Bird breed removed.");
      } catch (err) {
        setError(err.message || "Failed to delete bird breed.");
      } finally {
        setActionLoading(false);
        setConfirmDialog(null);
      }
    },
    [reloadHouseData, showToast]
  );

  // Delete Health Condition
  const deleteConditionHandler = useCallback(
    async (conditionId) => {
      try {
        setActionLoading(true);
        setError("");
        await deleteBirdCondition(conditionId);
        await reloadHouseData();
        showToast("Health inspection record deleted.");
      } catch (err) {
        setError(err.message || "Failed to delete health condition record.");
      } finally {
        setActionLoading(false);
        setConfirmDialog(null);
      }
    },
    [reloadHouseData, showToast]
  );

  // Delete Slaughter Plan
  const deleteSlaughterHandler = useCallback(
    async (planId) => {
      try {
        setActionLoading(true);
        setError("");
        await deleteSlaughterPlan(planId);
        await reloadHouseData();
        showToast("Slaughter plan deleted.");
      } catch (err) {
        setError(err.message || "Failed to delete slaughter plan.");
      } finally {
        setActionLoading(false);
        setConfirmDialog(null);
      }
    },
    [reloadHouseData, showToast]
  );

  // Toggle Slaughter Complete
  const toggleSlaughterCompleteHandler = useCallback(
    async (plan) => {
      try {
        setError("");
        await toggleSlaughterPlanComplete(plan.id, plan.status !== "Completed");
        await reloadHouseData();
        showToast(
          plan.status === "Completed"
            ? "Slaughter plan marked as pending."
            : "Slaughter plan marked as completed."
        );
      } catch (err) {
        setError(err.message || "Failed to update slaughter plan status.");
      }
    },
    [reloadHouseData, showToast]
  );

  // Delete Flock
  const deleteFlockHandler = useCallback(
    async (flockId) => {
      try {
        setActionLoading(true);
        setError("");
        await deleteFlock(flockId);
        await reloadHouseData();
        showToast("Flock batch removed.");
      } catch (err) {
        setError(err.message || "Failed to delete flock.");
      } finally {
        setActionLoading(false);
        setConfirmDialog(null);
      }
    },
    [reloadHouseData, showToast]
  );

  // Delete Vaccination
  const deleteVaccinationHandler = useCallback(
    async (vaccinationId) => {
      try {
        setActionLoading(true);
        setError("");
        await deleteVaccination(vaccinationId);
        await reloadHouseData();
        showToast("Vaccination record removed.");
      } catch (err) {
        setError(err.message || "Failed to delete vaccination.");
      } finally {
        setActionLoading(false);
        setConfirmDialog(null);
      }
    },
    [reloadHouseData, showToast]
  );

  const currentBirdsInHouse =
    dashboard?.statistics?.currentBirds ?? selectedHouse?.birdsPlaced ?? 0;

  const value = {
    currentUser,
    setCurrentUser,
    authChecked,
    handleLogout,
    handleAuthSuccess,
    houses,
    selectedHouse,
    setSelectedHouse,
    selectHouse,
    loadHouses,
    dashboard,
    records,
    breeds,
    conditions,
    slaughterPlans,
    flocks,
    vaccinations,
    currentBirdsInHouse,
    loading,
    error,
    setError,
    loadHouseData,
    reloadHouseData,
    feedInventoryVersion,
    notifyFeedInventoryChanged,
    eggInventoryVersion,
    notifyEggInventoryChanged,
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
    toggleSlaughterCompleteHandler,
    deleteFlockHandler,
    deleteVaccinationHandler,
  };

  return <FarmContext.Provider value={value}>{children}</FarmContext.Provider>;
}

export default FarmProvider;
