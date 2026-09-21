import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useFarm } from "../context/useFarm";
import {
  RecordsIcon,
  BreedsIcon,
  HealthIcon,
  SlaughterIcon,
  AlertTriangleIcon,
  ArrowRightIcon,
  FinanceIcon,
  InventoryIcon,
  FlockIcon,
  VaccineIcon,
} from "../components/Icons";
import { getFinancialSummary, getInventorySummary } from "../services/api";
import { formatCurrency, DEFAULT_CURRENCY } from "../services/currency";

function DashboardPage() {
  const navigate = useNavigate();
  const {
    selectedHouse,
    dashboard,
    breeds,
    records,
    flocks = [],
    vaccinations = [],
    setConfirmDialog,
    actionLoading,
  } = useFarm();

  const [financeSummary, setFinanceSummary] = useState(null);
  const [inventorySummary, setInventorySummary] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const fetchFinances = async () => {
      try {
        const res = await getFinancialSummary(selectedHouse?.id);
        if (!cancelled && res?.data) {
          setFinanceSummary(res.data);
        }
      } catch {
        // Non-blocking for main dashboard
      }
    };
    fetchFinances();

    const fetchInventory = async () => {
      try {
        const res = await getInventorySummary();
        if (!cancelled && res?.data) {
          setInventorySummary(res.data);
        }
      } catch {
        // Non-blocking
      }
    };
    fetchInventory();

    return () => {
      cancelled = true;
    };
  }, [selectedHouse?.id]);

  if (!selectedHouse) {
    return null;
  }

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

  const recentRecords = [...records]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 3);

  return (
    <div className="dashboard-page">
      {/* Poultry House Top Banner */}
      <section className="welcome">
        <div>
          <span className="section-eyebrow">Poultry House</span>
          <h2>{selectedHouse.name}</h2>
          <p>
            Overview of flock status, production metrics, health logs, and harvest planning.
          </p>
        </div>

        <div className="house-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() => navigate(`/houses/${selectedHouse.id}/edit`)}
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

      {/* KPI Stats Grid */}
      <section className="stats-grid">
        <div className="stat-card">
          <span className="stat-label">Current Birds</span>
          <strong>{dashboard?.statistics?.currentBirds ?? selectedHouse.birdsPlaced ?? 0}</strong>
          <span className="stat-description">
            Initial capacity: {selectedHouse.birdsPlaced} birds
          </span>
        </div>

        <div className="stat-card">
          <span className="stat-label">Total Mortality</span>
          <strong style={{ color: (dashboard?.statistics?.totalMortality ?? 0) > 0 ? "var(--alert-danger)" : "inherit" }}>
            {dashboard?.statistics?.totalMortality ?? 0}
          </strong>
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
            {Number(dashboard?.statistics?.totalFeedUsed ?? 0).toFixed(1)} kg
          </strong>
          <span className="stat-description">Cumulative consumption</span>
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

      {/* Harvest Alert Banner if urgent plans exist */}
      {urgentSlaughterCount > 0 && (
        <div
          className="summary-banner"
          style={{
            borderColor: "#fedf89",
            background: "#fffdf5",
            marginBottom: 24,
          }}
        >
          <div>
            <strong
              style={{
                color: "#b54708",
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: 4,
              }}
            >
              <AlertTriangleIcon size={16} /> Harvest Alert: {urgentSlaughterCount} Slaughter Plan(s) Requiring Attention
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
            onClick={() => navigate("/slaughter-planning")}
          >
            View Harvest Schedule
          </button>
        </div>
      )}

      {/* Feature Navigation Cards Grid */}
      <section className="quick-nav-section" style={{ marginBottom: 28 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--pine-900)", marginBottom: 14 }}>
          Farm Sections & Management
        </h3>
        <div className="quick-nav-grid">
          {/* Flocks & Batches */}
          <div className="quick-nav-card">
            <div className="quick-nav-card-header">
              <span className="quick-nav-icon"><FlockIcon size={20} /></span>
              <span className="badge badge-upcoming">
                {flocks.filter((f) => f.status === "ACTIVE").length} Active
              </span>
            </div>
            <h4>Flocks & Batches</h4>
            <p>Manage biological batches, track age, mortality rates, FCR, and laying percentages.</p>
            <Link to="/flocks" className="quick-nav-link">
              Manage Flocks <ArrowRightIcon size={14} />
            </Link>
          </div>

          {/* Daily Records */}
          <div className="quick-nav-card">
            <div className="quick-nav-card-header">
              <span className="quick-nav-icon"><RecordsIcon size={20} /></span>
              <span className="badge badge-upcoming">{records.length} Records</span>
            </div>
            <h4>Daily Records</h4>
            <p>Log mortality, feed usage in kilograms, and daily egg collection counts.</p>
            <Link to="/daily-records" className="quick-nav-link">
              View Daily Records <ArrowRightIcon size={14} />
            </Link>
          </div>

          {/* Vaccinations */}
          <div className="quick-nav-card">
            <div className="quick-nav-card-header">
              <span className="quick-nav-icon"><VaccineIcon size={20} /></span>
              <span
                className={`badge ${
                  vaccinations.filter((v) => v.status === "PENDING").length > 0
                    ? "badge-due-soon"
                    : "badge-healthy"
                }`}
              >
                {vaccinations.filter((v) => v.status === "PENDING").length} Pending
              </span>
            </div>
            <h4>Vaccinations & Health</h4>
            <p>Administer preventive medications and schedule disease immunizations.</p>
            <Link to="/vaccinations" className="quick-nav-link">
              View Schedule <ArrowRightIcon size={14} />
            </Link>
          </div>

          {/* Bird Breeds */}
          <div className="quick-nav-card">
            <div className="quick-nav-card-header">
              <span className="quick-nav-icon"><BreedsIcon size={20} /></span>
              <span className="badge badge-upcoming">{breeds.length} Breeds</span>
            </div>
            <h4>Bird Breeds</h4>
            <p>Manage chicken and poultry breed profiles, quantities, and dates added.</p>
            <Link to="/breeds" className="quick-nav-link">
              Manage Breeds <ArrowRightIcon size={14} />
            </Link>
          </div>

          {/* Health & Condition */}
          <div className="quick-nav-card">
            <div className="quick-nav-card-header">
              <span className="quick-nav-icon"><HealthIcon size={20} /></span>
              <span className="badge badge-healthy">
                {healthSummary.sick > 0 ? `${healthSummary.sick} Sick` : "Healthy"}
              </span>
            </div>
            <h4>Health & Condition</h4>
            <p>Monitor flock vitality: healthy, sick, weak, and isolated birds under observation.</p>
            <Link to="/health-condition" className="quick-nav-link">
              View Health Conditions <ArrowRightIcon size={14} />
            </Link>
          </div>

          {/* Slaughter Planning */}
          <div className="quick-nav-card">
            <div className="quick-nav-card-header">
              <span className="quick-nav-icon"><SlaughterIcon size={20} /></span>
              <span className="badge badge-due-soon">
                {slaughterSummary.totalBirdsPlanned} Planned
              </span>
            </div>
            <h4>Slaughter Planning</h4>
            <p>Schedule harvest dates, calculate feed cycles, and monitor slaughter readiness.</p>
            <Link to="/slaughter-planning" className="quick-nav-link">
              Manage Slaughter Plans <ArrowRightIcon size={14} />
            </Link>
          </div>

          {/* Farm Finances */}
          <div className="quick-nav-card">
            <div className="quick-nav-card-header">
              <span className="quick-nav-icon"><FinanceIcon size={20} /></span>
              <span className="badge badge-healthy">
                {financeSummary ? formatCurrency(financeSummary.netCashFlow, financeSummary.currency || DEFAULT_CURRENCY) : "Finances"}
              </span>
            </div>
            <h4>Farm Finances</h4>
            <p>Track feed and operational expenses, egg & bird sales, and cash flow.</p>
            <Link to="/finances" className="quick-nav-link">
              View Financials <ArrowRightIcon size={14} />
            </Link>
          </div>

          {/* Feed & Inventory */}
          <div className="quick-nav-card">
            <div className="quick-nav-card-header">
              <span className="quick-nav-icon"><InventoryIcon size={20} /></span>
              <span className={`badge ${inventorySummary?.lowStockCount > 0 ? "badge-due-soon" : "badge-upcoming"}`}>
                {inventorySummary?.lowStockCount > 0
                  ? `${inventorySummary.lowStockCount} Low Stock`
                  : `${inventorySummary?.totalFeedTypes ?? 0} Varieties`}
              </span>
            </div>
            <h4>Inventory & Feed</h4>
            <p>Track feed varieties, stock balances, purchase deliveries, and consumption.</p>
            <Link to="/inventory" className="quick-nav-link">
              Manage Inventory <ArrowRightIcon size={14} />
            </Link>
          </div>
        </div>
      </section>

      {/* Low Stock Alert on Dashboard */}
      {inventorySummary?.lowStockCount > 0 && (
        <div
          className="alert-banner alert-warning"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#fffbeb",
            border: "1px solid #fde68a",
            color: "#92400e",
            padding: "12px 16px",
            borderRadius: "8px",
            marginBottom: "24px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <AlertTriangleIcon size={20} />
            <div>
              <strong>Feed Stock Alert:</strong> {inventorySummary.lowStockCount} feed {inventorySummary.lowStockCount === 1 ? "variety is" : "varieties are"} running low and require replenishment.
            </div>
          </div>
          <Link to="/inventory" className="primary-button" style={{ padding: "6px 14px", fontSize: "13px", textDecoration: "none" }}>
            View Feed Stock
          </Link>
        </div>
      )}

      {/* Operational Summary Cards */}
      <div className="dashboard-summary-columns">
        {/* Health Breakdown Card */}
        <div className="summary-card">
          <div className="summary-card-header">
            <h4>Flock Health Breakdown</h4>
            <Link to="/health-condition" className="link-subtle">View Logs →</Link>
          </div>
          <div className="summary-metrics-grid">
            <div className="metric-pill">
              <span className="metric-name">Healthy</span>
              <strong className="metric-val text-success">{healthSummary.healthy}</strong>
            </div>
            <div className="metric-pill">
              <span className="metric-name">Sick</span>
              <strong className={`metric-val ${healthSummary.sick > 0 ? "text-danger" : ""}`}>
                {healthSummary.sick}
              </strong>
            </div>
            <div className="metric-pill">
              <span className="metric-name">Weak</span>
              <strong className={`metric-val ${healthSummary.weak > 0 ? "text-amber" : ""}`}>
                {healthSummary.weak}
              </strong>
            </div>
            <div className="metric-pill">
              <span className="metric-name">Observation</span>
              <strong className="metric-val text-info">{healthSummary.underObservation}</strong>
            </div>
          </div>
        </div>

        {/* Harvest Summary Card */}
        <div className="summary-card">
          <div className="summary-card-header">
            <h4>Slaughter Harvest Summary</h4>
            <Link to="/slaughter-planning" className="link-subtle">View Schedule →</Link>
          </div>
          <div className="summary-metrics-grid">
            <div className="metric-pill">
              <span className="metric-name">Upcoming</span>
              <strong className="metric-val">{slaughterSummary.upcoming}</strong>
            </div>
            <div className="metric-pill">
              <span className="metric-name">Due Today</span>
              <strong className={`metric-val ${slaughterSummary.dueToday > 0 ? "text-danger" : ""}`}>
                {slaughterSummary.dueToday}
              </strong>
            </div>
            <div className="metric-pill">
              <span className="metric-name">Due Soon (≤7d)</span>
              <strong className={`metric-val ${slaughterSummary.dueSoon > 0 ? "text-amber" : ""}`}>
                {slaughterSummary.dueSoon}
              </strong>
            </div>
            <div className="metric-pill">
              <span className="metric-name">Completed</span>
              <strong className="metric-val text-success">{slaughterSummary.completed}</strong>
            </div>
          </div>
        </div>

        {/* Recent Daily Production Snapshot */}
        <div className="summary-card">
          <div className="summary-card-header">
            <h4>Recent Production Logs</h4>
            <Link to="/daily-records" className="link-subtle">All Records →</Link>
          </div>
          {recentRecords.length === 0 ? (
            <p style={{ color: "var(--text-muted)", fontSize: 13, margin: "16px 0" }}>
              No production records logged yet.
            </p>
          ) : (
            <div className="compact-records-list">
              {recentRecords.map((r) => (
                <div key={r.id} className="compact-record-row">
                  <span className="compact-date">
                    {new Date(r.date).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                  <span className="compact-stat">
                    Mortality: <strong>{r.mortality}</strong>
                  </span>
                  <span className="compact-stat">
                    Feed: <strong>{r.feedUsedKg} kg</strong>
                  </span>
                  <span className="compact-stat">
                    Eggs: <strong>{r.eggsCollected}</strong>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Financial Overview Card */}
        <div className="summary-card">
          <div className="summary-card-header">
            <h4>Financial Overview</h4>
            <Link to="/finances" className="link-subtle">View Financials →</Link>
          </div>
          <div className="summary-metrics-grid">
            <div className="metric-pill">
              <span className="metric-name">Income</span>
              <strong className="metric-val text-success">
                {financeSummary ? formatCurrency(financeSummary.totalIncome, financeSummary.currency || DEFAULT_CURRENCY) : "—"}
              </strong>
            </div>
            <div className="metric-pill">
              <span className="metric-name">Expenses</span>
              <strong className="metric-val text-danger">
                {financeSummary ? formatCurrency(financeSummary.totalExpenses, financeSummary.currency || DEFAULT_CURRENCY) : "—"}
              </strong>
            </div>
            <div className="metric-pill" style={{ gridColumn: "span 2" }}>
              <span className="metric-name">Net Cash (Estimated Net)</span>
              <strong className={`metric-val ${(financeSummary?.netCashFlow ?? 0) >= 0 ? "text-success" : "text-danger"}`}>
                {financeSummary ? formatCurrency(financeSummary.netCashFlow, financeSummary.currency || DEFAULT_CURRENCY) : "—"}
              </strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;
