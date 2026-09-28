import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useFarm } from "../context/useFarm";
import PageHeader from "../components/common/PageHeader";
import EmptyState from "../components/common/EmptyState";
import FinanceTransactionModal from "../components/FinanceTransactionModal";
import FlockCloseoutModal from "../components/FlockCloseoutModal";
import { getFlockById, getFlockTrends } from "../services/api";
import { formatCurrency, DEFAULT_CURRENCY } from "../services/currency";

function TrendBars({ periods, valueKey, color, unit }) {
  const max = Math.max(1, ...periods.map((p) => Number(p[valueKey]) || 0));
  const label = (dateStr) =>
    new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${periods.length}, minmax(28px, 1fr))`, gap: 4, alignItems: "end", minHeight: 110 }}>
      {periods.map((p) => {
        const val = Number(p[valueKey]) || 0;
        const height = Math.max(3, (val / max) * 96);
        return (
          <div key={p.date} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }} title={`${label(p.date)}: ${val.toLocaleString()} ${unit}`}>
            <div style={{ fontSize: 10, fontWeight: 700 }}>{val.toLocaleString()}</div>
            <div style={{ width: "70%", maxWidth: 26, height, background: color, borderRadius: "3px 3px 0 0" }} />
            <div style={{ fontSize: 9, color: "var(--text-muted)" }}>{label(p.date)}</div>
          </div>
        );
      })}
    </div>
  );
}

function FlockDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    houses = [],
    flocks = [],
    selectedHouse,
    reloadHouseData,
    showToast,
    setConfirmDialog,
    deleteFlockHandler,
    notifyFeedInventoryChanged,
  } = useFarm();

  const [flock, setFlock] = useState(null);
  const [trends, setTrends] = useState([]);
  const [range, setRange] = useState("30d");
  const [loading, setLoading] = useState(true);
  const [trendsLoading, setTrendsLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [financeOpen, setFinanceOpen] = useState(false);
  const [financeType, setFinanceType] = useState("Expense");
  const [closeoutOpen, setCloseoutOpen] = useState(false);
  const [closeoutMode, setCloseoutMode] = useState("close");

  const fetchFlock = useCallback(async () => {
    try {
      setLoading(true);
      setNotFound(false);
      const res = await getFlockById(id);
      setFlock(res.data);
    } catch (err) {
      console.error("Failed to fetch flock:", err);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchTrends = useCallback(async () => {
    try {
      setTrendsLoading(true);
      const res = await getFlockTrends(id, range);
      setTrends(res.data?.periods || []);
    } catch (err) {
      console.error("Failed to fetch trends:", err);
      setTrends([]);
    } finally {
      setTrendsLoading(false);
    }
  }, [id, range]);

  useEffect(() => {
    fetchFlock();
  }, [fetchFlock]);

  useEffect(() => {
    fetchTrends();
  }, [fetchTrends]);

  const handleDelete = () => {
    setConfirmDialog({
      title: "Delete Flock",
      message: `Delete flock "${flock?.name}"? This is only allowed when the flock has no history.`,
      confirmLabel: "Delete Flock",
      isDangerous: true,
      onConfirm: async () => {
        try {
          await deleteFlockHandler(Number(id));
          navigate("/flocks");
        } catch {
          showToast("Failed to delete flock.", "error");
        }
      },
    });
  };

  const handleFinanceSaved = async () => {
    setFinanceOpen(false);
    await fetchFlock();
    await reloadHouseData();
    if (notifyFeedInventoryChanged) notifyFeedInventoryChanged();
    showToast("Transaction recorded and linked to this flock.");
  };

  const handleCloseoutDone = async () => {
    setCloseoutOpen(false);
    await fetchFlock();
    await reloadHouseData();
    showToast(closeoutMode === "reopen" ? "Flock reopened." : "Flock closed.");
  };

  if (loading) {
    return (
      <div className="flock-detail-page">
        <PageHeader title="Flock Details" description="Loading flock performance..." />
        <div style={{ padding: 30, textAlign: "center", color: "var(--text-secondary)" }}>Loading...</div>
      </div>
    );
  }

  if (notFound || !flock) {
    return (
      <div className="flock-detail-page">
        <PageHeader title="Flock Details" description="This flock could not be found." />
        <EmptyState icon="🐔" title="Flock not found" message="It may have been deleted or belong to another farm." actionText="Back to Flocks" onAction={() => navigate("/flocks")} />
      </div>
    );
  }

  const perf = flock.performance || {};
  const fin = flock.financials || {};
  const currency = fin.currency || DEFAULT_CURRENCY;
  const isLayer = flock.purpose === "LAYER";
  const recentRecords = [...(flock.dailyRecords || [])]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 10);

  return (
    <div className="flock-detail-page">
      <PageHeader
        eyebrow={flock.house ? `Poultry House: ${flock.house.name}` : undefined}
        title={`${flock.name}${flock.batchNumber ? ` (#${flock.batchNumber})` : ""}`}
        description={`${flock.purpose} · ${flock.status} · Placed ${flock.placementDate ? new Date(flock.placementDate).toLocaleDateString() : "—"}${flock.age?.formatted ? ` · ${flock.age.formatted}` : ""}`}
        actions={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {flock.status === "ACTIVE" ? (
              <button type="button" className="primary-button" onClick={() => { setCloseoutMode("close"); setCloseoutOpen(true); }}>Close Out Flock</button>
            ) : (
              <button type="button" className="primary-button" onClick={() => { setCloseoutMode("reopen"); setCloseoutOpen(true); }}>Reopen Flock</button>
            )}
            <button type="button" className="secondary-button" onClick={() => navigate(`/flocks/${id}/edit`)}>Edit</button>
            <button type="button" className="danger-button" onClick={handleDelete}>Delete</button>
          </div>
        }
      />

      {flock.status !== "ACTIVE" && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: 8, padding: "14px 18px", marginBottom: 20, color: "#334155", fontSize: 13, lineHeight: 1.5 }}>
          <div style={{ fontSize: 20, lineHeight: 1 }}>🔒</div>
          <div>
            <strong style={{ display: "block", marginBottom: 2 }}>Flock closed ({flock.status})</strong>
            <span>This flock is no longer accepting new operational records. Existing history, corrections, and the final summary remain available.</span>
          </div>
        </div>
      )}

      <div className="dashboard-grid" style={{ marginBottom: 20 }}>
        <div className="card stat-card">
          <div className="stat-label">Live Birds</div>
          <div className="stat-value">{Number(flock.currentBirds ?? 0).toLocaleString()}</div>
          <div className="stat-subtext">of {Number(flock.birdsPlaced ?? 0).toLocaleString()} placed</div>
        </div>
        <div className="card stat-card">
          <div className="stat-label">Mortality</div>
          <div className="stat-value">{Number(perf.totalMortality ?? 0).toLocaleString()}</div>
          <div className="stat-subtext">{perf.mortalityRate ?? 0}% loss rate</div>
        </div>
        <div className="card stat-card">
          <div className="stat-label">Depopulated</div>
          <div className="stat-value">{Number(perf.totalDepopulated ?? 0).toLocaleString()}</div>
          <div className="stat-subtext">Sales, harvest, culls, transfers</div>
        </div>
        <div className="card stat-card">
          <div className="stat-label">Eggs Collected</div>
          <div className="stat-value">{Number(perf.totalEggs ?? 0).toLocaleString()}</div>
          <div className="stat-subtext">Avg {Number(perf.avgDailyFeedKg ?? 0)} kg feed / day</div>
        </div>
      </div>

      <div className="card" style={{ padding: 18, marginBottom: 20 }}>
        <h3 style={{ margin: "0 0 4px" }}>Feed Efficiency</h3>
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 12px" }}>
          Based on recorded feed and current flock biomass. This is not weight-gain FCR.
        </p>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", fontSize: 14 }}>
          <span>Total feed: <strong>{Number(perf.totalFeedKg ?? 0).toLocaleString()} kg</strong></span>
          <span>Feed efficiency: <strong>{perf.fcr ?? "—"}</strong></span>
          <span>Latest weight: <strong>{perf.latestWeightGrams ? `${perf.latestWeightGrams} g` : "—"}</strong></span>
          <span>Feed / bird / day: <strong>{perf.avgFeedPerBirdGrams ?? 0} g</strong></span>
        </div>
      </div>

      {isLayer && (
        <div className="card" style={{ padding: 18, marginBottom: 20 }}>
          <h3 style={{ margin: "0 0 4px" }}>Laying Performance</h3>
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 12px" }}>
            Based on live birds in this flock. The system does not track hen count or sex, so this is not true hen-day production.
          </p>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap", fontSize: 14 }}>
            <span>Latest laying rate: <strong>{perf.latestLayingRate ?? "—"}%</strong></span>
            <span>Average laying rate: <strong>{perf.averageLayingRate ?? "—"}%</strong></span>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 18, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <div>
            <h3 style={{ margin: "0 0 4px" }}>Recorded Flock Financials</h3>
            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
              Based only on income and expenses currently linked to this flock. Farm or house-level costs are not allocated automatically.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="secondary-button" style={{ padding: "6px 10px", fontSize: 12 }} onClick={() => { setFinanceType("Expense"); setFinanceOpen(true); }}>
              + Record Cost
            </button>
            <button type="button" className="secondary-button" style={{ padding: "6px 10px", fontSize: 12 }} onClick={() => { setFinanceType("Income"); setFinanceOpen(true); }}>
              + Record Revenue
            </button>
          </div>
        </div>
        <div className="dashboard-grid" style={{ marginTop: 14 }}>
          <div className="card stat-card">
            <div className="stat-label">Linked Revenue</div>
            <div className="stat-value" style={{ color: "#16a34a" }}>{formatCurrency(fin.totalRevenue ?? 0, currency)}</div>
            <div className="stat-subtext">{formatCurrency(fin.revenuePerBird ?? 0, currency)} / bird placed</div>
          </div>
          <div className="card stat-card">
            <div className="stat-label">Linked Expenses</div>
            <div className="stat-value" style={{ color: "#dc2626" }}>{formatCurrency(fin.totalExpenses ?? 0, currency)}</div>
            <div className="stat-subtext">
              Feed {formatCurrency(fin.feedCost ?? 0, currency)} · Vaccines {formatCurrency(fin.vaccineCost ?? 0, currency)} · {formatCurrency(fin.costPerBird ?? 0, currency)} / bird
            </div>
          </div>
          <div className="card stat-card">
            <div className="stat-label">Recorded Net Result</div>
            <div className="stat-value" style={{ color: Number(fin.netProfitLoss ?? 0) >= 0 ? "#16a34a" : "#dc2626" }}>
              {formatCurrency(fin.netProfitLoss ?? 0, currency)}
            </div>
            <div className="stat-subtext">Linked revenue minus linked expenses</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 18, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Production Trends</h3>
          <div style={{ display: "flex", gap: 6 }}>
            <button type="button" className={`secondary-button${range === "30d" ? " active" : ""}`} style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => setRange("30d")}>
              30 days
            </button>
            <button type="button" className={`secondary-button${range === "12w" ? " active" : ""}`} style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => setRange("12w")}>
              12 weeks
            </button>
          </div>
        </div>
        {trendsLoading ? (
          <div style={{ padding: 20, textAlign: "center", color: "var(--text-secondary)" }}>Loading trends...</div>
        ) : trends.length === 0 ? (
          <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
            No production records in this period yet.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 18 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>🥚 Eggs {range === "30d" ? "per day" : "per week"}</div>
              <TrendBars periods={trends} valueKey="eggs" color="#eab308" unit="eggs" />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Mortality {range === "30d" ? "per day" : "per week"}</div>
              <TrendBars periods={trends} valueKey="mortality" color="#dc2626" unit="birds" />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>🌾 Feed (kg) {range === "30d" ? "per day" : "per week"}</div>
              <TrendBars periods={trends} valueKey="feedKg" color="#16a34a" unit="kg" />
            </div>
          </div>
        )}
      </div>

      <div className="records-section" style={{ marginBottom: 20 }}>
        <div className="section-toolbar">
          <h3 style={{ margin: 0 }}>Recent Daily Records</h3>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <Link className="secondary-button" style={{ padding: "4px 10px", fontSize: 12 }} to="/daily-records/new">+ Add Record</Link>
            <Link className="secondary-button" style={{ padding: "4px 10px", fontSize: 12 }} to="/daily-records">All Records</Link>
          </div>
        </div>
        {recentRecords.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
            No daily records for this flock yet.
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th style={{ textAlign: "right" }}>Mortality</th>
                  <th style={{ textAlign: "right" }}>Feed (kg)</th>
                  <th style={{ textAlign: "right" }}>Eggs</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {recentRecords.map((r) => (
                  <tr key={r.id}>
                    <td><strong>{new Date(r.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</strong></td>
                    <td style={{ textAlign: "right" }}>{r.mortality}</td>
                    <td style={{ textAlign: "right" }}>{r.feedUsedKg}</td>
                    <td style={{ textAlign: "right" }}>{r.eggsCollected}</td>
                    <td style={{ textAlign: "right" }}>
                      <Link className="secondary-button" style={{ padding: "4px 8px", fontSize: 11 }} to={`/daily-records/${r.id}/edit`}>Edit</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="records-section">
        <div className="section-toolbar">
          <h3 style={{ margin: 0 }}>Related Operations</h3>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: 16 }}>
          <Link className="secondary-button" style={{ padding: "6px 12px", fontSize: 12 }} to={`/depopulation?flockId=${id}`}>🚚 Depopulation & Sales ({(flock.depopulationEvents || []).length})</Link>
          <Link className="secondary-button" style={{ padding: "6px 12px", fontSize: 12 }} to={`/vaccinations?flockId=${id}`}>💉 Vaccinations ({(flock.vaccinations || []).length})</Link>
          <Link className="secondary-button" style={{ padding: "6px 12px", fontSize: 12 }} to="/finances">💰 Financials</Link>
        </div>
      </div>

      {financeOpen && (
        <FinanceTransactionModal
          isOpen={financeOpen}
          initialType={financeType}
          houses={houses}
          flocks={flocks}
          defaultHouseId={flock.houseId || selectedHouse?.id || null}
          defaultFlockId={flock.id}
          breeds={[]}
          onSuccess={handleFinanceSaved}
          onCancel={() => setFinanceOpen(false)}
        />
      )}
      {closeoutOpen && (
        <FlockCloseoutModal
          isOpen={closeoutOpen}
          onClose={() => setCloseoutOpen(false)}
          onConfirmed={handleCloseoutDone}
          flock={flock}
          mode={closeoutMode}
        />
      )}
    </div>
  );
}

export default FlockDetailPage;
