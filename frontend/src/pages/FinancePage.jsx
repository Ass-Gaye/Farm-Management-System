import { useState, useEffect, useCallback, useMemo } from "react";
import { useFarm } from "../context/useFarm";
import {
  getFinancialSummary,
  getFinancialTransactions,
  getFinancialReports,
  deleteExpense,
  deleteIncome,
} from "../services/api";
import { formatCurrency, DEFAULT_CURRENCY } from "../services/currency";
import FinanceTransactionModal, {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
} from "../components/FinanceTransactionModal";
import ConfirmDialog from "../components/ConfirmDialog";
import {
  FinanceIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  PlusIcon,
  SearchIcon,
  EditIcon,
  TrashIcon,
} from "../components/Icons";

function FinancePage() {
  const { houses, selectedHouse, showToast } = useFarm();

  // Summary state
  const [summary, setSummary] = useState({
    currency: DEFAULT_CURRENCY,
    totalIncome: 0,
    totalExpenses: 0,
    netCashFlow: 0,
    estimatedNet: 0,
    monthlyIncome: 0,
    monthlyExpenses: 0,
    weeklyIncome: 0,
    weeklyExpenses: 0,
  });

  // Transactions state
  const [transactions, setTransactions] = useState([]);
  const [reports, setReports] = useState({
    expenseBreakdown: [],
    incomeBreakdown: [],
    monthlyTrends: [],
  });

  // Filter state
  const [typeFilter, setTypeFilter] = useState("all"); // "all" | "Expense" | "Income"
  const [categoryFilter, setCategoryFilter] = useState("");
  const [houseFilter, setHouseFilter] = useState(selectedHouse?.id ? String(selectedHouse.id) : "");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState("desc");

  // Loading & Error states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState("Expense");
  const [editingItem, setEditingItem] = useState(null);

  // Deletion confirm state
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Load finance data
  const loadFinanceData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const houseIdParam = houseFilter ? Number(houseFilter) : undefined;

      const [summaryRes, transRes, reportsRes] = await Promise.all([
        getFinancialSummary(houseIdParam),
        getFinancialTransactions({
          houseId: houseIdParam,
          type: typeFilter !== "all" ? typeFilter.toLowerCase() : undefined,
          category: categoryFilter || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          search: searchQuery || undefined,
          sortOrder,
        }),
        getFinancialReports(houseIdParam),
      ]);

      if (summaryRes?.data) setSummary(summaryRes.data);
      if (transRes?.data) setTransactions(transRes.data);
      if (reportsRes?.data) setReports(reportsRes.data);
    } catch (err) {
      setError(err.message || "Failed to load financial records.");
    } finally {
      setLoading(false);
    }
  }, [houseFilter, typeFilter, categoryFilter, startDate, endDate, searchQuery, sortOrder]);

  useEffect(() => {
    loadFinanceData();
  }, [loadFinanceData]);

  // Handle transaction save (create or update)
  const handleModalSuccess = (savedItem, type, isEditing) => {
    setModalOpen(false);
    setEditingItem(null);
    showToast(
      isEditing
        ? `${type} transaction updated successfully.`
        : `${type} transaction recorded successfully.`
    );
    loadFinanceData();
  };

  // Handle delete execution
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;

    try {
      setDeleting(true);
      if (deleteTarget.type === "Expense") {
        await deleteExpense(deleteTarget.id);
      } else {
        await deleteIncome(deleteTarget.id);
      }
      showToast(`${deleteTarget.type} transaction deleted.`);
      setDeleteTarget(null);
      loadFinanceData();
    } catch (err) {
      showToast(err.message || "Failed to delete transaction.", "error");
    } finally {
      setDeleting(false);
    }
  };

  // Available categories based on active type filter
  const categoryOptions = useMemo(() => {
    if (typeFilter === "Expense") return EXPENSE_CATEGORIES;
    if (typeFilter === "Income") return INCOME_CATEGORIES;
    return [...new Set([...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES])];
  }, [typeFilter]);

  const currency = summary.currency || DEFAULT_CURRENCY;

  // Max value calculation for monthly chart scaling
  const maxMonthlyVal = useMemo(() => {
    if (!reports.monthlyTrends || reports.monthlyTrends.length === 0) return 1000;
    return Math.max(
      ...reports.monthlyTrends.map((m) => Math.max(m.income, m.expenses)),
      1000
    );
  }, [reports.monthlyTrends]);

  return (
    <div className="finance-page">
      {/* Top Banner with Actions */}
      <section className="welcome">
        <div>
          <span className="section-eyebrow">Financial Management</span>
          <h2>Farm Finances & Cash Flow</h2>
          <p>
            Track operational expenses, egg & bird sales revenues, and monitor your farm's cash flow.
          </p>
        </div>

        <div className="house-actions" style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              setModalType("Expense");
              setEditingItem(null);
              setModalOpen(true);
            }}
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <TrendingDownIcon size={16} /> Add Expense
          </button>

          <button
            type="button"
            className="primary-button"
            onClick={() => {
              setModalType("Income");
              setEditingItem(null);
              setModalOpen(true);
            }}
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <PlusIcon size={16} /> Add Income
          </button>
        </div>
      </section>

      {/* Global Error Notice */}
      {error && <div className="error-message">{error}</div>}

      {/* Primary KPI Summary Cards */}
      <section className="stats-grid" style={{ marginBottom: 24 }}>
        {/* Total Income */}
        <div className="stat-card">
          <span className="stat-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <TrendingUpIcon size={14} style={{ color: "var(--alert-success)" }} /> Total Income
          </span>
          <strong style={{ color: "var(--alert-success)", fontSize: 24 }}>
            {formatCurrency(summary.totalIncome, currency)}
          </strong>
          <span className="stat-description">
            This month: <strong>{formatCurrency(summary.monthlyIncome, currency)}</strong>
          </span>
          <span className="stat-description" style={{ marginTop: 2 }}>
            This week: {formatCurrency(summary.weeklyIncome, currency)}
          </span>
        </div>

        {/* Total Expenses */}
        <div className="stat-card">
          <span className="stat-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <TrendingDownIcon size={14} style={{ color: "var(--alert-danger)" }} /> Total Expenses
          </span>
          <strong style={{ color: "var(--alert-danger)", fontSize: 24 }}>
            {formatCurrency(summary.totalExpenses, currency)}
          </strong>
          <span className="stat-description">
            This month: <strong>{formatCurrency(summary.monthlyExpenses, currency)}</strong>
          </span>
          <span className="stat-description" style={{ marginTop: 2 }}>
            This week: {formatCurrency(summary.weeklyExpenses, currency)}
          </span>
        </div>

        {/* Net Cash Flow (Labeled Estimated Net) */}
        <div className="stat-card">
          <span className="stat-label">Net Cash Flow</span>
          <strong
            style={{
              fontSize: 24,
              color:
                summary.netCashFlow > 0
                  ? "var(--alert-success)"
                  : summary.netCashFlow < 0
                  ? "var(--alert-danger)"
                  : "inherit",
            }}
          >
            {formatCurrency(summary.netCashFlow, currency)}
          </strong>
          <span className="stat-description">
            Formula: Income ({formatCurrency(summary.totalIncome, currency)}) - Expenses ({formatCurrency(summary.totalExpenses, currency)})
          </span>
          <span
            className="stat-description"
            style={{
              marginTop: 4,
              color: "var(--text-muted)",
              fontStyle: "italic",
              fontSize: 11,
            }}
          >
            * Estimated Net cash position (excludes inventory & depreciation)
          </span>
        </div>
      </section>

      {/* Monthly Financial Performance Chart */}
      {reports.monthlyTrends && reports.monthlyTrends.length > 0 && (
        <div className="summary-card" style={{ marginBottom: 28 }}>
          <div className="summary-card-header">
            <h4>Monthly Income vs. Expenses</h4>
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
              Financial comparison over recorded months
            </span>
          </div>

          <div style={{ marginTop: 20 }}>
            <div style={{ display: "flex", gap: 20, marginBottom: 14, fontSize: 12 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span
                  style={{
                    width: 12,
                    height: 12,
                    background: "var(--field-600)",
                    borderRadius: 2,
                    display: "inline-block",
                  }}
                />
                Income
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span
                  style={{
                    width: 12,
                    height: 12,
                    background: "var(--alert-danger)",
                    borderRadius: 2,
                    display: "inline-block",
                  }}
                />
                Expenses
              </span>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${reports.monthlyTrends.length}, minmax(80px, 1fr))`,
                gap: 16,
                alignItems: "flex-end",
                minHeight: 180,
                paddingBottom: 8,
                borderBottom: "1px solid var(--border-default)",
                overflowX: "auto",
              }}
            >
              {reports.monthlyTrends.map((m) => {
                const incomeHeight = Math.max(
                  Math.round((m.income / maxMonthlyVal) * 140),
                  m.income > 0 ? 6 : 0
                );
                const expenseHeight = Math.max(
                  Math.round((m.expenses / maxMonthlyVal) * 140),
                  m.expenses > 0 ? 6 : 0
                );

                return (
                  <div
                    key={m.key}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-end",
                        gap: 6,
                        height: 140,
                      }}
                    >
                      {/* Income Bar */}
                      <div
                        title={`Income: ${formatCurrency(m.income, currency)}`}
                        style={{
                          width: 24,
                          height: `${incomeHeight}px`,
                          background: "var(--field-600)",
                          borderRadius: "4px 4px 0 0",
                          transition: "height 0.3s ease",
                        }}
                      />
                      {/* Expense Bar */}
                      <div
                        title={`Expenses: ${formatCurrency(m.expenses, currency)}`}
                        style={{
                          width: 24,
                          height: `${expenseHeight}px`,
                          background: "var(--alert-danger)",
                          borderRadius: "4px 4px 0 0",
                          transition: "height 0.3s ease",
                        }}
                      />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)" }}>
                      {m.monthLabel}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: m.netCashFlow >= 0 ? "var(--alert-success)" : "var(--alert-danger)",
                      }}
                    >
                      {m.netCashFlow >= 0 ? "+" : ""}
                      {formatCurrency(m.netCashFlow, currency)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Category Breakdowns (Income & Expenses) */}
      <div className="dashboard-summary-columns" style={{ marginBottom: 28 }}>
        {/* Expense Breakdown Card */}
        <div className="summary-card">
          <div className="summary-card-header">
            <h4>Expense Breakdown by Category</h4>
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
              Total: {formatCurrency(summary.totalExpenses, currency)}
            </span>
          </div>

          {reports.expenseBreakdown.length === 0 ? (
            <p style={{ color: "var(--text-muted)", fontSize: 13, margin: "16px 0" }}>
              No expenses recorded yet.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
              {reports.expenseBreakdown.map((cat) => (
                <div key={cat.category}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 13,
                      marginBottom: 4,
                    }}
                  >
                    <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                      {cat.category}
                    </span>
                    <span>
                      <strong>{formatCurrency(cat.total, currency)}</strong>{" "}
                      <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
                        ({cat.percentage}%)
                      </span>
                    </span>
                  </div>
                  <div
                    style={{
                      width: "100%",
                      height: 6,
                      background: "var(--bg-surface-muted)",
                      borderRadius: 3,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${cat.percentage}%`,
                        height: "100%",
                        background: "var(--alert-danger)",
                        borderRadius: 3,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Income Breakdown Card */}
        <div className="summary-card">
          <div className="summary-card-header">
            <h4>Income Breakdown by Category</h4>
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
              Total: {formatCurrency(summary.totalIncome, currency)}
            </span>
          </div>

          {reports.incomeBreakdown.length === 0 ? (
            <p style={{ color: "var(--text-muted)", fontSize: 13, margin: "16px 0" }}>
              No income recorded yet.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
              {reports.incomeBreakdown.map((cat) => (
                <div key={cat.category}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 13,
                      marginBottom: 4,
                    }}
                  >
                    <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                      {cat.category}
                    </span>
                    <span>
                      <strong>{formatCurrency(cat.total, currency)}</strong>{" "}
                      <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
                        ({cat.percentage}%)
                      </span>
                    </span>
                  </div>
                  <div
                    style={{
                      width: "100%",
                      height: 6,
                      background: "var(--bg-surface-muted)",
                      borderRadius: 3,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${cat.percentage}%`,
                        height: "100%",
                        background: "var(--field-600)",
                        borderRadius: 3,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Transactions Filter & Activity Table Section */}
      <section className="summary-card" style={{ marginBottom: 30 }}>
        <div className="summary-card-header" style={{ flexWrap: "wrap", gap: 12 }}>
          <div>
            <h4>Financial Transactions</h4>
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
              Showing {transactions.length} record(s)
            </span>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className={`filter-btn ${typeFilter === "all" ? "active" : ""}`}
              onClick={() => setTypeFilter("all")}
            >
              All Types
            </button>
            <button
              type="button"
              className={`filter-btn ${typeFilter === "Income" ? "active" : ""}`}
              onClick={() => setTypeFilter("Income")}
            >
              Income Only
            </button>
            <button
              type="button"
              className={`filter-btn ${typeFilter === "Expense" ? "active" : ""}`}
              onClick={() => setTypeFilter("Expense")}
            >
              Expenses Only
            </button>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
            padding: "16px 0",
            borderBottom: "1px solid var(--border-subtle)",
            marginBottom: 16,
          }}
        >
          {/* Search Box */}
          <div style={{ position: "relative" }}>
            <span
              style={{
                position: "absolute",
                left: 10,
                top: 10,
                color: "var(--text-muted)",
                pointerEvents: "none",
              }}
            >
              <SearchIcon size={14} />
            </span>
            <input
              type="text"
              placeholder="Search description / category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                paddingLeft: 30,
                paddingRight: 10,
                paddingTop: 8,
                paddingBottom: 8,
                fontSize: 13,
                border: "1px solid var(--border-default)",
                borderRadius: "var(--radius-sm)",
              }}
            />
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                fontSize: 13,
                border: "1px solid var(--border-default)",
                borderRadius: "var(--radius-sm)",
              }}
            >
              <option value="">All Categories</option>
              {categoryOptions.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* House Filter */}
          <div>
            <select
              value={houseFilter}
              onChange={(e) => setHouseFilter(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                fontSize: 13,
                border: "1px solid var(--border-default)",
                borderRadius: "var(--radius-sm)",
              }}
            >
              <option value="">All Houses & Farm</option>
              {houses.map((house) => (
                <option key={house.id} value={house.id}>
                  {house.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range Start */}
          <div>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              title="Filter from date"
              style={{
                width: "100%",
                padding: "8px 12px",
                fontSize: 13,
                border: "1px solid var(--border-default)",
                borderRadius: "var(--radius-sm)",
              }}
            />
          </div>

          {/* Date Range End */}
          <div>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              title="Filter to date"
              style={{
                width: "100%",
                padding: "8px 12px",
                fontSize: 13,
                border: "1px solid var(--border-default)",
                borderRadius: "var(--radius-sm)",
              }}
            />
          </div>

          {/* Sort Order */}
          <div>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                fontSize: 13,
                border: "1px solid var(--border-default)",
                borderRadius: "var(--radius-sm)",
              }}
            >
              <option value="desc">Date: Newest First</option>
              <option value="asc">Date: Oldest First</option>
            </select>
          </div>
        </div>

        {/* Transactions Table */}
        {loading ? (
          <p style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
            Loading financial transactions...
          </p>
        ) : transactions.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>
              No financial transactions found.
            </p>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>
              {searchQuery || categoryFilter || startDate || endDate
                ? "Try clearing your search filters to view recorded activity."
                : "Start by recording your first poultry feed expense or egg/bird sale revenue."}
            </p>
            <div style={{ display: "flex", justifyContent: "center", gap: 10 }}>
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setModalType("Expense");
                  setEditingItem(null);
                  setModalOpen(true);
                }}
              >
                + Record Expense
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={() => {
                  setModalType("Income");
                  setEditingItem(null);
                  setModalOpen(true);
                }}
              >
                + Record Income
              </button>
            </div>
          </div>
        ) : (
          <div className="table-wrapper" style={{ overflowX: "auto" }}>
            <table className="data-table" style={{ width: "100%", textAlign: "left" }}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Category</th>
                  <th>House / Scope</th>
                  <th>Description</th>
                  <th style={{ textAlign: "right" }}>Amount</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => {
                  const isExpense = tx.type === "Expense";

                  return (
                    <tr key={`${tx.type}-${tx.id}`}>
                      {/* Date */}
                      <td style={{ whiteSpace: "nowrap", fontWeight: 600 }}>
                        {new Date(tx.date).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </td>

                      {/* Type Badge */}
                      <td>
                        <span
                          className={`badge ${isExpense ? "badge-overdue" : "badge-healthy"}`}
                          style={{
                            fontWeight: 700,
                            padding: "3px 8px",
                            fontSize: 11,
                          }}
                        >
                          {isExpense ? "Expense" : "Income"}
                        </span>
                      </td>

                      {/* Category */}
                      <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                        {tx.category}
                      </td>

                      {/* House Scope */}
                      <td>
                        {tx.house?.name ? (
                          <span className="badge badge-upcoming">{tx.house.name}</span>
                        ) : (
                          <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
                            Farm-wide
                          </span>
                        )}
                      </td>

                      {/* Description */}
                      <td
                        style={{
                          maxWidth: 240,
                          fontSize: 13,
                          color: tx.description ? "var(--text-secondary)" : "var(--text-muted)",
                        }}
                      >
                        {tx.description || "—"}
                      </td>

                      {/* Amount */}
                      <td
                        style={{
                          textAlign: "right",
                          whiteSpace: "nowrap",
                          fontWeight: 700,
                          color: isExpense ? "var(--alert-danger)" : "var(--alert-success)",
                        }}
                      >
                        {isExpense ? "- " : "+ "}
                        {formatCurrency(tx.amount, currency)}
                      </td>

                      {/* Action Buttons */}
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <button
                          type="button"
                          className="table-action-button"
                          onClick={() => {
                            setEditingItem(tx);
                            setModalType(tx.type);
                            setModalOpen(true);
                          }}
                          title={`Edit ${tx.type}`}
                          style={{ marginRight: 6 }}
                        >
                          <EditIcon size={14} />
                        </button>
                        <button
                          type="button"
                          className="table-action-button text-danger"
                          onClick={() => setDeleteTarget(tx)}
                          title={`Delete ${tx.type}`}
                        >
                          <TrashIcon size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Add / Edit Transaction Modal */}
      <FinanceTransactionModal
        isOpen={modalOpen}
        initialType={modalType}
        initialData={editingItem}
        houses={houses}
        defaultHouseId={houseFilter ? Number(houseFilter) : selectedHouse?.id || null}
        currency={currency}
        onSuccess={handleModalSuccess}
        onCancel={() => {
          setModalOpen(false);
          setEditingItem(null);
        }}
      />

      {/* Delete Confirmation Dialog */}
      {deleteTarget && (
        <ConfirmDialog
          title={`Delete ${deleteTarget.type} Transaction?`}
          message={`Are you sure you want to delete this ${deleteTarget.type.toLowerCase()} record of ${formatCurrency(
            deleteTarget.amount,
            currency
          )} (${deleteTarget.category})? This cannot be undone.`}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDeleteConfirm}
          loading={deleting}
        />
      )}
    </div>
  );
}

export default FinancePage;
