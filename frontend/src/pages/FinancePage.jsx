import { useState, useEffect, useCallback, useMemo } from "react";
import { useFarm } from "../context/useFarm";
import {
  getFinancialSummary,
  getFinancialTransactions,
  getFinancialReports,
  getCustomers,
  getSuppliers,
  deleteExpense,
  deleteIncome,
  deleteCustomer,
  deleteSupplier,
} from "../services/api";
import { formatCurrency, DEFAULT_CURRENCY } from "../services/currency";
import FinanceTransactionModal, {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
} from "../components/FinanceTransactionModal";
import CustomerModal from "../components/CustomerModal";
import SupplierModal from "../components/SupplierModal";
import CustomerDetailModal from "../components/CustomerDetailModal";
import SupplierDetailModal from "../components/SupplierDetailModal";
import ReceiptModal from "../components/ReceiptModal";
import PaymentModal from "../components/PaymentModal";
import ConfirmDialog from "../components/ConfirmDialog";
import {
  TrendingUpIcon,
  TrendingDownIcon,
  PlusIcon,
  SearchIcon,
  EditIcon,
  TrashIcon,
} from "../components/Icons";

function FinancePage() {
  const { houses, selectedHouse, breeds, showToast, notifyFeedInventoryChanged } = useFarm();

  // Active view tab: "overview" | "sales" | "expenses" | "customers" | "suppliers" | "reports"
  const [activeTab, setActiveTab] = useState("overview");

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
    totalCustomerOutstanding: 0,
    totalSupplierOutstanding: 0,
    eggSalesTotal: 0,
    birdSalesTotal: 0,
    feedExpenseTotal: 0,
  });

  // Entities state
  const [transactions, setTransactions] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [reports, setReports] = useState({
    expenseBreakdown: [],
    incomeBreakdown: [],
    monthlyTrends: [],
    eggSalesSummary: null,
    birdSalesSummary: null,
    feedCostSummary: null,
    customerDebtSummary: null,
    supplierPayablesSummary: null,
  });

  // Filter state for transactions
  const [typeFilter, setTypeFilter] = useState("all"); // "all" | "Expense" | "Income"
  const [categoryFilter, setCategoryFilter] = useState("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("");
  const [houseFilter] = useState(selectedHouse?.id ? String(selectedHouse.id) : "");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder] = useState("desc");

  // Filter state for reports
  const [reportDateRange, setReportDateRange] = useState("month"); // "today" | "week" | "month" | "last_month" | "year" | "custom"
  const [reportCustomStart, setReportCustomStart] = useState("");
  const [reportCustomEnd, setReportCustomEnd] = useState("");

  // Customer/Supplier list search filter
  const [partySearch, setPartySearch] = useState("");

  // Loading & Error states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Modals state
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [txModalType, setTxModalType] = useState("Income");
  const [editingItem, setEditingItem] = useState(null);

  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);

  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);

  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [selectedSupplierId, setSelectedSupplierId] = useState(null);

  const [receiptSale, setReceiptSale] = useState(null);
  const [paymentTarget, setPaymentTarget] = useState(null);

  // Deletion confirm state
  const [deleteTarget, setDeleteTarget] = useState(null); // { type: 'Expense'|'Income'|'Customer'|'Supplier', item }
  const [deleting, setDeleting] = useState(false);

  // Load finance data
  const loadFinanceData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const houseIdParam = houseFilter ? Number(houseFilter) : undefined;

      const [summaryRes, transRes, reportsRes, custRes, suppRes] = await Promise.all([
        getFinancialSummary(houseIdParam),
        getFinancialTransactions({
          houseId: houseIdParam,
          type: typeFilter !== "all" ? typeFilter.toLowerCase() : undefined,
          category: categoryFilter || undefined,
          paymentStatus: paymentStatusFilter || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          search: searchQuery || undefined,
          sortOrder,
        }),
        getFinancialReports({
          houseId: houseIdParam,
          dateRange: reportDateRange,
          startDate: reportCustomStart || undefined,
          endDate: reportCustomEnd || undefined,
        }),
        getCustomers(),
        getSuppliers(),
      ]);

      if (summaryRes?.data) setSummary(summaryRes.data);
      if (transRes?.data) setTransactions(transRes.data);
      if (reportsRes?.data) setReports(reportsRes.data);
      if (custRes?.data) setCustomers(custRes.data);
      if (suppRes?.data) setSuppliers(suppRes.data);
    } catch (err) {
      setError(err.message || "Failed to load financial records.");
    } finally {
      setLoading(false);
    }
  }, [
    houseFilter,
    typeFilter,
    categoryFilter,
    paymentStatusFilter,
    startDate,
    endDate,
    searchQuery,
    sortOrder,
    reportDateRange,
    reportCustomStart,
    reportCustomEnd,
  ]);

  useEffect(() => {
    loadFinanceData();
  }, [loadFinanceData]);

  // Handle transaction save (create or update)
  const handleTxSuccess = (savedItem, type, isEditing) => {
    setTxModalOpen(false);
    setEditingItem(null);
    showToast(
      isEditing
        ? `${type} transaction updated successfully.`
        : `${type} transaction recorded successfully.`
    );
    loadFinanceData();
  };

  // Handle customer save
  const handleCustomerSuccess = (customer, isEditing) => {
    setCustomerModalOpen(false);
    setEditingCustomer(null);
    showToast(isEditing ? "Customer updated successfully." : "Customer created successfully.");
    loadFinanceData();
  };

  // Handle supplier save
  const handleSupplierSuccess = (supplier, isEditing) => {
    setSupplierModalOpen(false);
    setEditingSupplier(null);
    showToast(isEditing ? "Supplier updated successfully." : "Supplier created successfully.");
    loadFinanceData();
  };

  // Handle delete execution
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;

    if (deleteTarget.type === "Supplier" && deleteTarget.outstanding > 0) {
      showToast(
        `Cannot delete supplier "${deleteTarget.name}" while an outstanding balance of ${formatCurrency(
          deleteTarget.outstanding,
          currency
        )} exists. Please settle all payables before deleting.`,
        "error"
      );
      setDeleteTarget(null);
      return;
    }

    try {
      setDeleting(true);
      if (deleteTarget.type === "Expense") {
        await deleteExpense(deleteTarget.id);
        showToast("Expense record deleted.");
      } else if (deleteTarget.type === "Income") {
        await deleteIncome(deleteTarget.id);
        showToast("Sale/Income record deleted.");
      } else if (deleteTarget.type === "Customer") {
        await deleteCustomer(deleteTarget.id);
        showToast("Customer removed.");
      } else if (deleteTarget.type === "Supplier") {
        await deleteSupplier(deleteTarget.id);
        showToast("Supplier removed.");
      }
      setDeleteTarget(null);
      loadFinanceData();
      if (notifyFeedInventoryChanged) {
        notifyFeedInventoryChanged();
      }
    } catch (err) {
      showToast(err.message || "Failed to delete item.", "error");
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  // Filtered sales and expenses
  const salesList = useMemo(() => {
    return transactions.filter((t) => t.type === "Income");
  }, [transactions]);

  const expensesList = useMemo(() => {
    return transactions.filter((t) => t.type === "Expense");
  }, [transactions]);

  // Filtered customers
  const filteredCustomers = useMemo(() => {
    if (!partySearch.trim()) return customers;
    const q = partySearch.trim().toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.toLowerCase().includes(q)) ||
        (c.address && c.address.toLowerCase().includes(q))
    );
  }, [customers, partySearch]);

  // Filtered suppliers
  const filteredSuppliers = useMemo(() => {
    if (!partySearch.trim()) return suppliers;
    const q = partySearch.trim().toLowerCase();
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.category && s.category.toLowerCase().includes(q)) ||
        (s.phone && s.phone.toLowerCase().includes(q))
    );
  }, [suppliers, partySearch]);

  const currency = summary.currency || DEFAULT_CURRENCY;

  // Chart scaling
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
          <span className="section-eyebrow">Farm Business Finance</span>
          <h2>Financial Management & Sales</h2>
          <p>
            Track egg & bird sales, farm operational expenses, customer credit debts, and supplier payables.
          </p>
        </div>

        <div className="house-actions" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              setTxModalType("Expense");
              setEditingItem(null);
              setTxModalOpen(true);
            }}
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <TrendingDownIcon size={16} /> Record Purchase
          </button>

          <button
            type="button"
            className="primary-button"
            onClick={() => {
              setTxModalType("Income");
              setEditingItem(null);
              setTxModalOpen(true);
            }}
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <PlusIcon size={16} /> Record Sale
          </button>
        </div>
      </section>

      {/* Global Error Notice */}
      {error && <div className="error-message">{error}</div>}

      {/* Sub-Tabs Navigation */}
      <nav
        className="tabs-nav"
        style={{ marginBottom: 20, borderBottom: "1px solid var(--border-default)" }}
        aria-label="Finance navigation"
      >
        <button
          type="button"
          className={`tab-button ${activeTab === "overview" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("overview");
            setTypeFilter("all");
            setCategoryFilter("");
          }}
        >
          📊 Overview
        </button>
        <button
          type="button"
          className={`tab-button ${activeTab === "sales" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("sales");
            setTypeFilter("Income");
            setCategoryFilter("");
          }}
        >
          💰 Sales & Receivables {summary.totalCustomerOutstanding > 0 && <span className="tab-badge badge-due-soon">{formatCurrency(summary.totalCustomerOutstanding, currency)}</span>}
        </button>
        <button
          type="button"
          className={`tab-button ${activeTab === "expenses" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("expenses");
            setTypeFilter("Expense");
            setCategoryFilter("");
          }}
        >
          💸 Purchases & Payables {summary.totalSupplierOutstanding > 0 && <span className="tab-badge badge-overdue">{formatCurrency(summary.totalSupplierOutstanding, currency)}</span>}
        </button>
        <button
          type="button"
          className={`tab-button ${activeTab === "customers" ? "active" : ""}`}
          onClick={() => setActiveTab("customers")}
        >
          👥 Customers ({customers.length})
        </button>
        <button
          type="button"
          className={`tab-button ${activeTab === "suppliers" ? "active" : ""}`}
          onClick={() => setActiveTab("suppliers")}
        >
          🏢 Suppliers ({suppliers.length})
        </button>
        <button
          type="button"
          className={`tab-button ${activeTab === "reports" ? "active" : ""}`}
          onClick={() => setActiveTab("reports")}
        >
          📈 Reports & Analytics
        </button>
      </nav>

      {/* ========================================================= */}
      {/* 1. OVERVIEW TAB                                           */}
      {/* ========================================================= */}
      {activeTab === "overview" && (
        <>
          {/* Primary 5 KPI Summary Cards */}
          <section
            className="stats-grid"
            style={{
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              marginBottom: 24,
            }}
          >
            {/* Total Sales */}
            <div className="stat-card">
              <span className="stat-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <TrendingUpIcon size={14} style={{ color: "var(--alert-success)" }} /> Total Sales
              </span>
              <strong style={{ color: "var(--alert-success)", fontSize: 22 }}>
                {formatCurrency(summary.totalIncome, currency)}
              </strong>
              <span className="stat-description">
                This month: <strong>{formatCurrency(summary.monthlyIncome, currency)}</strong>
              </span>
              <span className="stat-description" style={{ marginTop: 2 }}>
                Eggs: {formatCurrency(summary.eggSalesTotal, currency)}
              </span>
            </div>

            {/* Total Expenses */}
            <div className="stat-card">
              <span className="stat-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <TrendingDownIcon size={14} style={{ color: "var(--alert-danger)" }} /> Total Expenses
              </span>
              <strong style={{ color: "var(--alert-danger)", fontSize: 22 }}>
                {formatCurrency(summary.totalExpenses, currency)}
              </strong>
              <span className="stat-description">
                This month: <strong>{formatCurrency(summary.monthlyExpenses, currency)}</strong>
              </span>
              <span className="stat-description" style={{ marginTop: 2 }}>
                Feed: {formatCurrency(summary.feedExpenseTotal, currency)}
              </span>
            </div>

            {/* Net Cash Flow */}
            <div className="stat-card">
              <span className="stat-label">Net Cash Flow</span>
              <strong
                style={{
                  fontSize: 22,
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
                Sales minus expenses
              </span>
              <span className="stat-description" style={{ marginTop: 2, fontSize: 11, color: "var(--text-muted)" }}>
                * Cash basis position
              </span>
            </div>

            {/* Customer Receivables (Credit Owed to Farm) */}
            <div className="stat-card">
              <span className="stat-label" style={{ color: summary.totalCustomerOutstanding > 0 ? "#b45309" : "inherit" }}>
                Customers Owe
              </span>
              <strong
                style={{
                  fontSize: 22,
                  color: summary.totalCustomerOutstanding > 0 ? "#d97706" : "var(--alert-success)",
                }}
              >
                {formatCurrency(summary.totalCustomerOutstanding, currency)}
              </strong>
              <span className="stat-description">
                {summary.totalCustomerOutstanding > 0
                  ? "Uncollected customer debt"
                  : "All customer sales settled"}
              </span>
              <button
                type="button"
                className="link-subtle"
                onClick={() => {
                  setActiveTab("sales");
                  setTypeFilter("Income");
                  setCategoryFilter("");
                  setPaymentStatusFilter("UNSETTLED");
                }}
                style={{ marginTop: 4, textAlign: "left", fontSize: 11, background: "none", border: "none", cursor: "pointer" }}
              >
                View Debtors →
              </button>
            </div>

            {/* Supplier Payables (Farm Debt Owed to Suppliers) */}
            <div className="stat-card">
              <span className="stat-label" style={{ color: summary.totalSupplierOutstanding > 0 ? "var(--alert-danger)" : "inherit" }}>
                You Owe Suppliers
              </span>
              <strong
                style={{
                  fontSize: 22,
                  color: summary.totalSupplierOutstanding > 0 ? "var(--alert-danger)" : "var(--alert-success)",
                }}
              >
                {formatCurrency(summary.totalSupplierOutstanding, currency)}
              </strong>
              <span className="stat-description">
                {summary.totalSupplierOutstanding > 0
                  ? "Money owed to suppliers"
                  : "All supply orders settled"}
              </span>
              <button
                type="button"
                className="link-subtle"
                onClick={() => {
                  setActiveTab("expenses");
                  setTypeFilter("Expense");
                  setCategoryFilter("");
                  setPaymentStatusFilter("UNSETTLED");
                }}
                style={{ marginTop: 4, textAlign: "left", fontSize: 11, background: "none", border: "none", cursor: "pointer" }}
              >
                View Payables →
              </button>
            </div>
          </section>

          {/* Monthly Financial Performance Chart */}
          {reports.monthlyTrends && reports.monthlyTrends.length > 0 && (
            <div className="summary-card" style={{ marginBottom: 28 }}>
              <div className="summary-card-header">
                <h4>Monthly Sales vs. Expenses</h4>
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                  Monthly operational cash flow comparison
                </span>
              </div>

              <div style={{ marginTop: 20 }}>
                <div style={{ display: "flex", gap: 20, marginBottom: 14, fontSize: 12 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 12, height: 12, background: "var(--field-600)", borderRadius: 2, display: "inline-block" }} />
                    Sales
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 12, height: 12, background: "var(--alert-danger)", borderRadius: 2, display: "inline-block" }} />
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
                        style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}
                      >
                        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 140 }}>
                          <div
                            title={`Sales: ${formatCurrency(m.income, currency)}`}
                            style={{
                              width: 24,
                              height: `${incomeHeight}px`,
                              background: "var(--field-600)",
                              borderRadius: "4px 4px 0 0",
                            }}
                          />
                          <div
                            title={`Expenses: ${formatCurrency(m.expenses, currency)}`}
                            style={{
                              width: 24,
                              height: `${expenseHeight}px`,
                              background: "var(--alert-danger)",
                              borderRadius: "4px 4px 0 0",
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

          {/* Quick Category Summary Grid */}
          <div className="dashboard-summary-columns" style={{ marginBottom: 28 }}>
            {/* Top Sales Breakdown */}
            <div className="summary-card">
              <div className="summary-card-header">
                <h4>Sales Breakdown</h4>
                <button
                  type="button"
                  className="link-subtle"
                  onClick={() => {
                    setActiveTab("sales");
                    setTypeFilter("Income");
                    setCategoryFilter("");
                  }}
                  style={{ background: "none", border: "none", cursor: "pointer" }}
                >
                  All Sales →
                </button>
              </div>

              {reports.incomeBreakdown.length === 0 ? (
                <p style={{ color: "var(--text-muted)", fontSize: 13, margin: "16px 0" }}>
                  No sales recorded yet.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
                  {reports.incomeBreakdown.map((cat) => (
                    <div key={cat.category}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                        <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{cat.category}</span>
                        <span>
                          <strong>{formatCurrency(cat.total, currency)}</strong>{" "}
                          <span style={{ color: "var(--text-muted)", fontSize: 12 }}>({cat.percentage}%)</span>
                        </span>
                      </div>
                      <div style={{ width: "100%", height: 6, background: "var(--bg-surface-muted)", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ width: `${cat.percentage}%`, height: "100%", background: "var(--field-600)", borderRadius: 3 }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top Expense Breakdown */}
            <div className="summary-card">
              <div className="summary-card-header">
                <h4>Expense Breakdown</h4>
                <button
                  type="button"
                  className="link-subtle"
                  onClick={() => {
                    setActiveTab("expenses");
                    setTypeFilter("Expense");
                    setCategoryFilter("");
                  }}
                  style={{ background: "none", border: "none", cursor: "pointer" }}
                >
                  All Expenses →
                </button>
              </div>

              {reports.expenseBreakdown.length === 0 ? (
                <p style={{ color: "var(--text-muted)", fontSize: 13, margin: "16px 0" }}>
                  No expenses recorded yet.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
                  {reports.expenseBreakdown.map((cat) => (
                    <div key={cat.category}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                        <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{cat.category}</span>
                        <span>
                          <strong>{formatCurrency(cat.total, currency)}</strong>{" "}
                          <span style={{ color: "var(--text-muted)", fontSize: 12 }}>({cat.percentage}%)</span>
                        </span>
                      </div>
                      <div style={{ width: "100%", height: 6, background: "var(--bg-surface-muted)", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ width: `${cat.percentage}%`, height: "100%", background: "var(--alert-danger)", borderRadius: 3 }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Unified Recent Financial Transactions (Income & Expenses together) */}
          <section className="summary-card" style={{ marginBottom: 30 }}>
            <div className="summary-card-header" style={{ flexWrap: "wrap", gap: 12 }}>
              <div>
                <h4>Recent Financial Transactions</h4>
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                  Combined sales and expense transactions ({transactions.length} record{transactions.length === 1 ? "" : "s"})
                </span>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    setTxModalType("Expense");
                    setEditingItem(null);
                    setTxModalOpen(true);
                  }}
                  style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}
                >
                  <TrendingDownIcon size={14} /> + Expense
                </button>
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => {
                    setTxModalType("Income");
                    setEditingItem(null);
                    setTxModalOpen(true);
                  }}
                  style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}
                >
                  <PlusIcon size={14} /> + Sale
                </button>
              </div>
            </div>

            {/* Filters */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: 12,
                padding: "16px 0",
                borderBottom: "1px solid var(--border-subtle)",
                marginBottom: 16,
              }}
            >
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 10, top: 10, color: "var(--text-muted)", pointerEvents: "none" }}>
                  <SearchIcon size={14} />
                </span>
                <input
                  type="text"
                  placeholder="Search transactions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ width: "100%", paddingLeft: 30, paddingRight: 10, paddingTop: 8, paddingBottom: 8, fontSize: 13 }}
                />
              </div>

              <div>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", fontSize: 13 }}
                >
                  <option value="all">All Types (Income & Expenses)</option>
                  <option value="Income">Sales & Income Only</option>
                  <option value="Expense">Purchases & Expenses Only</option>
                </select>
              </div>

              <div>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", fontSize: 13 }}
                >
                  <option value="">All Categories</option>
                  <optgroup label="Income Categories">
                    {INCOME_CATEGORIES.map((c) => (
                      <option key={`inc-${c}`} value={c}>
                        {c}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Expense Categories">
                    {EXPENSE_CATEGORIES.map((c) => (
                      <option key={`exp-${c}`} value={c}>
                        {c}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  title="From date"
                  style={{ width: "100%", padding: "8px 12px", fontSize: 13 }}
                />
              </div>

              <div>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  title="To date"
                  style={{ width: "100%", padding: "8px 12px", fontSize: 13 }}
                />
              </div>
            </div>

            {/* Unified Table */}
            {loading ? (
              <p style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
                Loading transactions...
              </p>
            ) : transactions.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 20px" }}>
                <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>
                  No transactions recorded.
                </p>
                <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>
                  Record sales and farm operational expenses to start tracking cash flow.
                </p>
                <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => {
                      setTxModalType("Income");
                      setEditingItem(null);
                      setTxModalOpen(true);
                    }}
                  >
                    + Record Sale
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      setTxModalType("Expense");
                      setEditingItem(null);
                      setTxModalOpen(true);
                    }}
                  >
                    + Record Expense
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
                      <th>Category & Details</th>
                      <th>House</th>
                      <th>Party</th>
                      <th style={{ textAlign: "right" }}>Amount</th>
                      <th style={{ textAlign: "right" }}>Balance Due</th>
                      <th>Status</th>
                      <th style={{ textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx) => {
                      const isIncome = tx.type === "Income";
                      const partyName = isIncome
                        ? tx.customer?.name || "Cash Buyer"
                        : tx.supplier?.name || "General Supplier";

                      return (
                        <tr key={`${tx.type}-${tx.id}`}>
                          <td style={{ whiteSpace: "nowrap", fontWeight: 600 }}>
                            {new Date(tx.date).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </td>

                          <td>
                            <span
                              className={`badge ${isIncome ? "badge-healthy" : "badge-overdue"}`}
                              style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11 }}
                            >
                              {isIncome ? <TrendingUpIcon size={12} /> : <TrendingDownIcon size={12} />}
                              {isIncome ? "Sale" : "Expense"}
                            </span>
                          </td>

                          <td>
                            <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                              {tx.category}
                            </div>
                            {tx.quantity && (
                              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                                {tx.quantity} {tx.unit || "units"}
                                {tx.unitPrice ? ` @ ${currency} ${tx.unitPrice}` : ""}
                              </div>
                            )}
                            {!isIncome && tx.feedType && (
                              <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
                                🌾 {tx.feedType.name} → shared stock
                              </div>
                            )}
                            {tx.description && (
                              <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
                                {tx.description}
                              </div>
                            )}
                          </td>

                          <td style={{ fontSize: 12 }}>
                            {tx.house?.name ? (
                              <span className="badge badge-upcoming" style={{ fontSize: 11 }}>
                                {tx.house.name}
                              </span>
                            ) : (
                              <span style={{ color: "var(--text-muted)" }}>Farm wide</span>
                            )}
                          </td>

                          <td style={{ fontSize: 12 }}>
                            {partyName}
                          </td>

                          <td
                            style={{
                              textAlign: "right",
                              fontWeight: 700,
                              color: isIncome ? "var(--alert-success)" : "var(--alert-danger)",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {isIncome ? "+" : "-"}
                            {formatCurrency(tx.amount, currency)}
                          </td>

                          <td
                            style={{
                              textAlign: "right",
                              fontSize: 12,
                              fontWeight: tx.amountDue > 0 ? 600 : 400,
                              color: tx.amountDue > 0 ? "var(--alert-danger)" : "var(--text-muted)",
                            }}
                          >
                            {tx.amountDue > 0 ? formatCurrency(tx.amountDue, currency) : "Settled"}
                          </td>

                          <td>
                            <span
                              className={`badge ${
                                tx.paymentStatus === "PAID"
                                  ? "badge-healthy"
                                  : tx.paymentStatus === "PARTIALLY_PAID"
                                  ? "badge-due-soon"
                                  : "badge-overdue"
                              }`}
                              style={{ fontSize: 11 }}
                            >
                              {tx.paymentStatus}
                            </span>
                          </td>

                          <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                            {tx.amountDue > 0 && (
                              <button
                                type="button"
                                className="table-action-button"
                                onClick={() => setPaymentTarget({ type: tx.type, item: tx })}
                                title={isIncome ? "Receive Customer Payment" : "Settle Supplier Payable"}
                                style={{ marginRight: 6, color: "var(--field-700)" }}
                              >
                                💳
                              </button>
                            )}

                            {isIncome && (
                              <button
                                type="button"
                                className="table-action-button"
                                onClick={() => setReceiptSale(tx)}
                                title="Print Receipt"
                                style={{ marginRight: 6 }}
                              >
                                🧾
                              </button>
                            )}

                            <button
                              type="button"
                              className="table-action-button"
                              onClick={() => {
                                setEditingItem(tx);
                                setTxModalType(tx.type);
                                setTxModalOpen(true);
                              }}
                              title={`Edit ${tx.type}`}
                              style={{ marginRight: 6 }}
                            >
                              <EditIcon size={14} />
                            </button>

                            <button
                              type="button"
                              className="table-action-button text-danger"
                              onClick={() => setDeleteTarget({ type: tx.type, id: tx.id, ...tx })}
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
        </>
      )}

      {/* ========================================================= */}
      {/* 2. SALES & INCOME TAB                                     */}
      {/* ========================================================= */}
      {activeTab === "sales" && (
        <section className="summary-card" style={{ marginBottom: 30 }}>
          <div className="summary-card-header" style={{ flexWrap: "wrap", gap: 12 }}>
            <div>
              <h4>Poultry Sales History</h4>
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                Showing {salesList.length} recorded sale(s)
              </span>
            </div>

            <button
              type="button"
              className="primary-button"
              onClick={() => {
                setTxModalType("Income");
                setEditingItem(null);
                setTxModalOpen(true);
              }}
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <PlusIcon size={16} /> Record Egg or Bird Sale
            </button>
          </div>

          {/* Sales Filters */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: 12,
              padding: "16px 0",
              borderBottom: "1px solid var(--border-subtle)",
              marginBottom: 16,
            }}
          >
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 10, top: 10, color: "var(--text-muted)", pointerEvents: "none" }}>
                <SearchIcon size={14} />
              </span>
              <input
                type="text"
                placeholder="Search buyer, item..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: "100%", paddingLeft: 30, paddingRight: 10, paddingTop: 8, paddingBottom: 8, fontSize: 13 }}
              />
            </div>

            <div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                style={{ width: "100%", padding: "8px 12px", fontSize: 13 }}
              >
                <option value="">All Products</option>
                {INCOME_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={paymentStatusFilter}
                onChange={(e) => setPaymentStatusFilter(e.target.value)}
                style={{ width: "100%", padding: "8px 12px", fontSize: 13 }}
              >
                <option value="">All Payment Statuses</option>
                <option value="UNSETTLED">All Unsettled (Unpaid & Partially Paid)</option>
                <option value="PAID">PAID (Settled)</option>
                <option value="PARTIALLY_PAID">PARTIALLY PAID (Outstanding)</option>
                <option value="UNPAID">UNPAID</option>
              </select>
            </div>

            <div>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                title="From date"
                style={{ width: "100%", padding: "8px 12px", fontSize: 13 }}
              />
            </div>

            <div>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                title="To date"
                style={{ width: "100%", padding: "8px 12px", fontSize: 13 }}
              />
            </div>
          </div>

          {/* Sales Table */}
          {loading ? (
            <p style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
              Loading sales records...
            </p>
          ) : salesList.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>
                No sales records found.
              </p>
              <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>
                Record your first egg tray or bird sale.
              </p>
              <button
                type="button"
                className="primary-button"
                onClick={() => {
                  setTxModalType("Income");
                  setEditingItem(null);
                  setTxModalOpen(true);
                }}
              >
                + Record Sale
              </button>
            </div>
          ) : (
            <div className="table-wrapper" style={{ overflowX: "auto" }}>
              <table className="data-table" style={{ width: "100%", textAlign: "left" }}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Product</th>
                    <th>Qty / Price</th>
                    <th style={{ textAlign: "right" }}>Total</th>
                    <th style={{ textAlign: "right" }}>Paid</th>
                    <th style={{ textAlign: "right" }}>Balance</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {salesList.map((sale) => (
                    <tr key={sale.id}>
                      <td style={{ whiteSpace: "nowrap", fontWeight: 600 }}>
                        {new Date(sale.date).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>

                      <td>
                        {sale.customer ? (
                          <button
                            type="button"
                            className="link-subtle"
                            onClick={() => setSelectedCustomerId(sale.customer.id)}
                            style={{ fontWeight: 600, background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
                          >
                            {sale.customer.name}
                          </button>
                        ) : (
                          <span style={{ color: "var(--text-muted)", fontSize: 12 }}>Cash Buyer</span>
                        )}
                      </td>

                      <td>
                        <span style={{ fontWeight: 600 }}>{sale.category}</span>
                        {sale.house?.name && (
                          <span className="badge badge-upcoming" style={{ marginLeft: 6, fontSize: 10 }}>
                            {sale.house.name}
                          </span>
                        )}
                      </td>

                      <td style={{ fontSize: 12 }}>
                        {sale.quantity ? (
                          <span>
                            {sale.quantity} {sale.unit || ""}
                            {sale.unitPrice ? ` @ ${currency} ${sale.unitPrice}` : ""}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>

                      <td style={{ textAlign: "right", fontWeight: 700, color: "var(--alert-success)" }}>
                        {formatCurrency(sale.amount, currency)}
                      </td>

                      <td style={{ textAlign: "right", color: "var(--text-secondary)", fontSize: 13 }}>
                        {formatCurrency(sale.amountPaid, currency)}
                      </td>

                      <td
                        style={{
                          textAlign: "right",
                          fontWeight: sale.amountDue > 0 ? 700 : 400,
                          color: sale.amountDue > 0 ? "var(--alert-danger)" : "var(--text-muted)",
                        }}
                      >
                        {formatCurrency(sale.amountDue, currency)}
                      </td>

                      <td>
                        <span
                          className={`badge ${
                            sale.paymentStatus === "PAID"
                              ? "badge-healthy"
                              : sale.paymentStatus === "PARTIALLY_PAID"
                              ? "badge-due-soon"
                              : "badge-overdue"
                          }`}
                        >
                          {sale.paymentStatus}
                        </span>
                      </td>

                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        {sale.amountDue > 0 && (
                          <button
                            type="button"
                            className="table-action-button"
                            onClick={() => setPaymentTarget({ type: "Income", item: sale })}
                            title="Receive Customer Payment"
                            style={{ marginRight: 6, color: "var(--field-700)" }}
                          >
                            💳
                          </button>
                        )}
                        <button
                          type="button"
                          className="table-action-button"
                          onClick={() => setReceiptSale(sale)}
                          title="View & Print Receipt"
                          style={{ marginRight: 6 }}
                        >
                          🧾
                        </button>
                        <button
                          type="button"
                          className="table-action-button"
                          onClick={() => {
                            setEditingItem(sale);
                            setTxModalType("Income");
                            setTxModalOpen(true);
                          }}
                          title="Edit Sale"
                          style={{ marginRight: 6 }}
                        >
                          <EditIcon size={14} />
                        </button>
                        <button
                          type="button"
                          className="table-action-button text-danger"
                          onClick={() => setDeleteTarget({ type: "Income", id: sale.id, ...sale })}
                          title="Delete Sale"
                        >
                          <TrashIcon size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ========================================================= */}
      {/* 3. PURCHASES & EXPENSES TAB                               */}
      {/* ========================================================= */}
      {activeTab === "expenses" && (
        <section className="summary-card" style={{ marginBottom: 30 }}>
          <div className="summary-card-header" style={{ flexWrap: "wrap", gap: 12 }}>
            <div>
              <h4>Farm Purchases & Operational Expenses</h4>
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                Showing {expensesList.length} recorded purchase(s)
              </span>
            </div>

            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setTxModalType("Expense");
                setEditingItem(null);
                setTxModalOpen(true);
              }}
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <PlusIcon size={16} /> Record Feed or Supply Purchase
            </button>
          </div>

          {/* Expenses Filters */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: 12,
              padding: "16px 0",
              borderBottom: "1px solid var(--border-subtle)",
              marginBottom: 16,
            }}
          >
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 10, top: 10, color: "var(--text-muted)", pointerEvents: "none" }}>
                <SearchIcon size={14} />
              </span>
              <input
                type="text"
                placeholder="Search vendor, item..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: "100%", paddingLeft: 30, paddingRight: 10, paddingTop: 8, paddingBottom: 8, fontSize: 13 }}
              />
            </div>

            <div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                style={{ width: "100%", padding: "8px 12px", fontSize: 13 }}
              >
                <option value="">All Categories</option>
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={paymentStatusFilter}
                onChange={(e) => setPaymentStatusFilter(e.target.value)}
                style={{ width: "100%", padding: "8px 12px", fontSize: 13 }}
              >
                <option value="">All Payment Statuses</option>
                <option value="UNSETTLED">All Unsettled (Unpaid & Partially Paid)</option>
                <option value="PAID">PAID (Settled)</option>
                <option value="PARTIALLY_PAID">PARTIALLY PAID (Payable Owed)</option>
                <option value="UNPAID">UNPAID</option>
              </select>
            </div>

            <div>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                title="From date"
                style={{ width: "100%", padding: "8px 12px", fontSize: 13 }}
              />
            </div>

            <div>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                title="To date"
                style={{ width: "100%", padding: "8px 12px", fontSize: 13 }}
              />
            </div>
          </div>

          {/* Expenses Table */}
          {loading ? (
            <p style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
              Loading expense records...
            </p>
          ) : expensesList.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>
                No expenses found.
              </p>
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setTxModalType("Expense");
                  setEditingItem(null);
                  setTxModalOpen(true);
                }}
              >
                + Record Expense
              </button>
            </div>
          ) : (
            <div className="table-wrapper" style={{ overflowX: "auto" }}>
              <table className="data-table" style={{ width: "100%", textAlign: "left" }}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Supplier</th>
                    <th>Category</th>
                    <th>Qty / Cost</th>
                    <th style={{ textAlign: "right" }}>Total</th>
                    <th style={{ textAlign: "right" }}>Paid</th>
                    <th style={{ textAlign: "right" }}>Payables Due</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {expensesList.map((exp) => (
                    <tr key={exp.id}>
                      <td style={{ whiteSpace: "nowrap", fontWeight: 600 }}>
                        {new Date(exp.date).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>

                      <td>
                        {exp.supplier ? (
                          <button
                            type="button"
                            className="link-subtle"
                            onClick={() => setSelectedSupplierId(exp.supplier.id)}
                            style={{ fontWeight: 600, background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
                          >
                            {exp.supplier.name}
                          </button>
                        ) : (
                          <span style={{ color: "var(--text-muted)", fontSize: 12 }}>General</span>
                        )}
                      </td>

                      <td>
                        <span style={{ fontWeight: 600 }}>{exp.category}</span>
                        {exp.house?.name && (
                          <span className="badge badge-upcoming" style={{ marginLeft: 6, fontSize: 10 }}>
                            {exp.house.name}
                          </span>
                        )}
                      </td>

                      <td style={{ fontSize: 12 }}>
                        {exp.quantity ? (
                          <span>
                            {exp.quantity} {exp.unit || ""}
                            {exp.unitPrice ? ` @ ${currency} ${exp.unitPrice}` : ""}
                          </span>
                        ) : (
                          exp.description || "—"
                        )}
                        {exp.feedType && (
                          <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
                            🌾 {exp.feedType.name} → shared stock
                          </div>
                        )}
                      </td>

                      <td style={{ textAlign: "right", fontWeight: 700, color: "var(--alert-danger)" }}>
                        {formatCurrency(exp.amount, currency)}
                      </td>

                      <td style={{ textAlign: "right", color: "var(--text-secondary)", fontSize: 13 }}>
                        {formatCurrency(exp.amountPaid, currency)}
                      </td>

                      <td
                        style={{
                          textAlign: "right",
                          fontWeight: exp.amountDue > 0 ? 700 : 400,
                          color: exp.amountDue > 0 ? "var(--alert-danger)" : "var(--text-muted)",
                        }}
                      >
                        {formatCurrency(exp.amountDue, currency)}
                      </td>

                      <td>
                        <span
                          className={`badge ${
                            exp.paymentStatus === "PAID"
                              ? "badge-healthy"
                              : exp.paymentStatus === "PARTIALLY_PAID"
                              ? "badge-due-soon"
                              : "badge-overdue"
                          }`}
                        >
                          {exp.paymentStatus}
                        </span>
                      </td>

                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        {exp.amountDue > 0 && (
                          <button
                            type="button"
                            className="table-action-button"
                            onClick={() => setPaymentTarget({ type: "Expense", item: exp })}
                            title="Settle Supplier Payable"
                            style={{ marginRight: 6, color: "var(--alert-danger)" }}
                          >
                            💳
                          </button>
                        )}
                        <button
                          type="button"
                          className="table-action-button"
                          onClick={() => {
                            setEditingItem(exp);
                            setTxModalType("Expense");
                            setTxModalOpen(true);
                          }}
                          title="Edit Expense"
                          style={{ marginRight: 6 }}
                        >
                          <EditIcon size={14} />
                        </button>
                        <button
                          type="button"
                          className="table-action-button text-danger"
                          onClick={() => setDeleteTarget({ type: "Expense", id: exp.id, ...exp })}
                          title="Delete Expense"
                        >
                          <TrashIcon size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ========================================================= */}
      {/* 4. CUSTOMERS TAB                                          */}
      {/* ========================================================= */}
      {activeTab === "customers" && (
        <section className="summary-card" style={{ marginBottom: 30 }}>
          <div className="summary-card-header" style={{ flexWrap: "wrap", gap: 12 }}>
            <div>
              <h4>Farm Customer Management & Credit Tracking</h4>
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                Buyers, egg retailers, market vendors, and restaurants
              </span>
            </div>

            <button
              type="button"
              className="primary-button"
              onClick={() => {
                setEditingCustomer(null);
                setCustomerModalOpen(true);
              }}
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <PlusIcon size={16} /> Add New Customer
            </button>
          </div>

          {/* Search bar */}
          <div style={{ padding: "14px 0", borderBottom: "1px solid var(--border-subtle)", marginBottom: 16 }}>
            <div style={{ position: "relative", maxWidth: 360 }}>
              <span style={{ position: "absolute", left: 10, top: 10, color: "var(--text-muted)", pointerEvents: "none" }}>
                <SearchIcon size={14} />
              </span>
              <input
                type="text"
                placeholder="Search customer name, phone, location..."
                value={partySearch}
                onChange={(e) => setPartySearch(e.target.value)}
                style={{ width: "100%", paddingLeft: 30, paddingRight: 10, paddingTop: 8, paddingBottom: 8, fontSize: 13 }}
              />
            </div>
          </div>

          {filteredCustomers.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>
                No customers yet.
              </p>
              <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
                Create customer profiles to monitor sales, egg orders, and credit debts.
              </p>
              <button
                type="button"
                className="primary-button"
                onClick={() => {
                  setEditingCustomer(null);
                  setCustomerModalOpen(true);
                }}
              >
                + Add Customer
              </button>
            </div>
          ) : (
            <div className="table-wrapper" style={{ overflowX: "auto" }}>
              <table className="data-table" style={{ width: "100%", textAlign: "left" }}>
                <thead>
                  <tr>
                    <th>Customer Name</th>
                    <th>Contact Phone</th>
                    <th>Location</th>
                    <th style={{ textAlign: "right" }}>Total Purchases</th>
                    <th style={{ textAlign: "right" }}>Amount Paid</th>
                    <th style={{ textAlign: "right" }}>Customer Owes</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map((cust) => (
                    <tr key={cust.id}>
                      <td>
                        <button
                          type="button"
                          className="link-subtle"
                          onClick={() => setSelectedCustomerId(cust.id)}
                          style={{ fontWeight: 700, fontSize: 14, background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
                        >
                          {cust.name}
                        </button>
                      </td>

                      <td style={{ fontSize: 13 }}>{cust.phone || "—"}</td>
                      <td style={{ fontSize: 13, color: "var(--text-muted)" }}>{cust.address || "—"}</td>

                      <td style={{ textAlign: "right", fontWeight: 600 }}>
                        {formatCurrency(cust.totalPurchases, currency)}
                      </td>

                      <td style={{ textAlign: "right", color: "var(--alert-success)" }}>
                        {formatCurrency(cust.totalPaid, currency)}
                      </td>

                      <td
                        style={{
                          textAlign: "right",
                          fontWeight: cust.outstandingBalance > 0 ? 700 : 400,
                          color: cust.outstandingBalance > 0 ? "var(--alert-danger)" : "var(--alert-success)",
                        }}
                      >
                        {formatCurrency(cust.outstandingBalance, currency)}
                      </td>

                      <td>
                        <span className={`badge ${cust.active ? "badge-healthy" : "badge-overdue"}`}>
                          {cust.active ? "Active" : "Inactive"}
                        </span>
                      </td>

                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => setSelectedCustomerId(cust.id)}
                          style={{ padding: "4px 8px", fontSize: 11, marginRight: 6 }}
                        >
                          Statement
                        </button>
                        <button
                          type="button"
                          className="table-action-button"
                          onClick={() => {
                            setEditingCustomer(cust);
                            setCustomerModalOpen(true);
                          }}
                          title="Edit Customer"
                          style={{ marginRight: 6 }}
                        >
                          <EditIcon size={14} />
                        </button>
                        <button
                          type="button"
                          className="table-action-button text-danger"
                          onClick={() => setDeleteTarget({ type: "Customer", id: cust.id, name: cust.name })}
                          title="Delete Customer"
                        >
                          <TrashIcon size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ========================================================= */}
      {/* 5. SUPPLIERS TAB                                          */}
      {/* ========================================================= */}
      {activeTab === "suppliers" && (
        <section className="summary-card" style={{ marginBottom: 30 }}>
          <div className="summary-card-header" style={{ flexWrap: "wrap", gap: 12 }}>
            <div>
              <h4>Farm Supplier & Feed Mill Partners</h4>
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                Feed suppliers, medication vendors, equipment providers
              </span>
            </div>

            <button
              type="button"
              className="primary-button"
              onClick={() => {
                setEditingSupplier(null);
                setSupplierModalOpen(true);
              }}
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <PlusIcon size={16} /> Add New Supplier
            </button>
          </div>

          {/* Search bar */}
          <div style={{ padding: "14px 0", borderBottom: "1px solid var(--border-subtle)", marginBottom: 16 }}>
            <div style={{ position: "relative", maxWidth: 360 }}>
              <span style={{ position: "absolute", left: 10, top: 10, color: "var(--text-muted)", pointerEvents: "none" }}>
                <SearchIcon size={14} />
              </span>
              <input
                type="text"
                placeholder="Search supplier, category, phone..."
                value={partySearch}
                onChange={(e) => setPartySearch(e.target.value)}
                style={{ width: "100%", paddingLeft: 30, paddingRight: 10, paddingTop: 8, paddingBottom: 8, fontSize: 13 }}
              />
            </div>
          </div>

          {filteredSuppliers.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>
                No suppliers yet.
              </p>
              <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
                Register feed mills and health suppliers to track costs and payables owed.
              </p>
              <button
                type="button"
                className="primary-button"
                onClick={() => {
                  setEditingSupplier(null);
                  setSupplierModalOpen(true);
                }}
              >
                + Add Supplier
              </button>
            </div>
          ) : (
            <div className="table-wrapper" style={{ overflowX: "auto" }}>
              <table className="data-table" style={{ width: "100%", textAlign: "left" }}>
                <thead>
                  <tr>
                    <th>Supplier Name</th>
                    <th>Category</th>
                    <th>Contact Phone</th>
                    <th style={{ textAlign: "right" }}>Total Purchases</th>
                    <th style={{ textAlign: "right" }}>Paid Out</th>
                    <th style={{ textAlign: "right" }}>You Owe Supplier</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSuppliers.map((supp) => (
                    <tr key={supp.id}>
                      <td>
                        <button
                          type="button"
                          className="link-subtle"
                          onClick={() => setSelectedSupplierId(supp.id)}
                          style={{ fontWeight: 700, fontSize: 14, background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
                        >
                          {supp.name}
                        </button>
                      </td>

                      <td>
                        <span className="badge badge-upcoming" style={{ fontSize: 11 }}>
                          {supp.category || "General"}
                        </span>
                      </td>

                      <td style={{ fontSize: 13 }}>{supp.phone || "—"}</td>

                      <td style={{ textAlign: "right", fontWeight: 600 }}>
                        {formatCurrency(supp.totalPurchases, currency)}
                      </td>

                      <td style={{ textAlign: "right", color: "var(--alert-success)" }}>
                        {formatCurrency(supp.totalPaid, currency)}
                      </td>

                      <td
                        style={{
                          textAlign: "right",
                          fontWeight: supp.outstandingPayables > 0 ? 700 : 400,
                          color: supp.outstandingPayables > 0 ? "var(--alert-danger)" : "var(--alert-success)",
                        }}
                      >
                        {formatCurrency(supp.outstandingPayables, currency)}
                      </td>

                      <td>
                        <span className={`badge ${supp.active ? "badge-healthy" : "badge-overdue"}`}>
                          {supp.active ? "Active" : "Inactive"}
                        </span>
                      </td>

                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => setSelectedSupplierId(supp.id)}
                          style={{ padding: "4px 8px", fontSize: 11, marginRight: 6 }}
                        >
                          Statement
                        </button>
                        <button
                          type="button"
                          className="table-action-button"
                          onClick={() => {
                            setEditingSupplier(supp);
                            setSupplierModalOpen(true);
                          }}
                          title="Edit Supplier"
                          style={{ marginRight: 6 }}
                        >
                          <EditIcon size={14} />
                        </button>
                        <button
                          type="button"
                          className="table-action-button text-danger"
                          onClick={() =>
                            setDeleteTarget({
                              type: "Supplier",
                              id: supp.id,
                              name: supp.name,
                              outstanding: Number(supp.outstandingPayables || 0),
                            })
                          }
                          title={
                            Number(supp.outstandingPayables || 0) > 0
                              ? "Cannot delete supplier with outstanding debt"
                              : "Delete Supplier"
                          }
                        >
                          <TrashIcon size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ========================================================= */}
      {/* 6. REPORTS & ANALYTICS TAB                                */}
      {/* ========================================================= */}
      {activeTab === "reports" && (
        <section style={{ marginBottom: 30 }}>
          {/* Date Presets Toolbar */}
          <div
            className="summary-card"
            style={{
              padding: "16px 20px",
              marginBottom: 20,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", alignSelf: "center", marginRight: 6 }}>
                Period:
              </span>
              {[
                { id: "today", label: "Today" },
                { id: "week", label: "This Week" },
                { id: "month", label: "This Month" },
                { id: "last_month", label: "Last Month" },
                { id: "year", label: "This Year" },
                { id: "custom", label: "Custom Range" },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`filter-btn ${reportDateRange === p.id ? "active" : ""}`}
                  onClick={() => setReportDateRange(p.id)}
                  style={{ padding: "6px 10px", fontSize: 12 }}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {reportDateRange === "custom" && (
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="date"
                  value={reportCustomStart}
                  onChange={(e) => setReportCustomStart(e.target.value)}
                  style={{ padding: "6px 10px", fontSize: 12 }}
                />
                <span style={{ fontSize: 12 }}>to</span>
                <input
                  type="date"
                  value={reportCustomEnd}
                  onChange={(e) => setReportCustomEnd(e.target.value)}
                  style={{ padding: "6px 10px", fontSize: 12 }}
                />
              </div>
            )}
          </div>

          {/* Business KPI Breakdown Cards Grid */}
          <div className="stats-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", marginBottom: 24 }}>
            {/* Egg Sales Summary */}
            <div className="stat-card">
              <span className="stat-label">🥚 Egg Sales Performance</span>
              <strong style={{ fontSize: 20, color: "var(--field-600)" }}>
                {formatCurrency(reports.eggSalesSummary?.totalRevenue || 0, currency)}
              </strong>
              <span className="stat-description">
                Total trays/crates: <strong>{reports.eggSalesSummary?.totalQuantity || 0}</strong>
              </span>
              <span className="stat-description" style={{ marginTop: 2 }}>
                Orders: {reports.eggSalesSummary?.count || 0} • Avg: {formatCurrency(reports.eggSalesSummary?.averageRevenue || 0, currency)}
              </span>
            </div>

            {/* Bird Sales Summary */}
            <div className="stat-card">
              <span className="stat-label">🐔 Bird Sales Performance</span>
              <strong style={{ fontSize: 20, color: "var(--alert-success)" }}>
                {formatCurrency(reports.birdSalesSummary?.totalRevenue || 0, currency)}
              </strong>
              <span className="stat-description">
                Birds sold: <strong>{reports.birdSalesSummary?.totalQuantity || 0}</strong>
              </span>
              <span className="stat-description" style={{ marginTop: 2 }}>
                Orders: {reports.birdSalesSummary?.count || 0} • Avg: {formatCurrency(reports.birdSalesSummary?.averageRevenue || 0, currency)}
              </span>
            </div>

            {/* Feed Purchase Summary */}
            <div className="stat-card">
              <span className="stat-label">🌾 Feed Cost Tracking</span>
              <strong style={{ fontSize: 20, color: "var(--alert-danger)" }}>
                {formatCurrency(reports.feedCostSummary?.totalSpent || 0, currency)}
              </strong>
              <span className="stat-description">
                Bags/kg purchased: <strong>{reports.feedCostSummary?.totalQuantity || 0}</strong>
              </span>
              <span className="stat-description" style={{ marginTop: 2 }}>
                Purchases: {reports.feedCostSummary?.count || 0} • Cost/run: {formatCurrency(reports.feedCostSummary?.averageSpent || 0, currency)}
              </span>
            </div>

            {/* Total Receivables & Payables */}
            <div className="stat-card">
              <span className="stat-label">⚖️ Credit & Debt Balances</span>
              <div style={{ marginTop: 4 }}>
                <span style={{ fontSize: 11, color: "var(--text-muted)", display: "block" }}>Customer Debt:</span>
                <strong style={{ fontSize: 16, color: "#d97706" }}>
                  {formatCurrency(reports.customerDebtSummary?.totalOutstanding || 0, currency)}
                </strong>
              </div>
              <div style={{ marginTop: 6 }}>
                <span style={{ fontSize: 11, color: "var(--text-muted)", display: "block" }}>Supplier Payables:</span>
                <strong style={{ fontSize: 16, color: "var(--alert-danger)" }}>
                  {formatCurrency(reports.supplierPayablesSummary?.totalOutstanding || 0, currency)}
                </strong>
              </div>
            </div>
          </div>

          {/* Top Debtors & Suppliers Payables Grid */}
          <div className="dashboard-summary-columns" style={{ marginBottom: 28 }}>
            {/* Top Customer Debts */}
            <div className="summary-card">
              <div className="summary-card-header">
                <h4>Customer Receivables (Money Owed to Farm)</h4>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  Total: {formatCurrency(reports.customerDebtSummary?.totalOutstanding || 0, currency)}
                </span>
              </div>

              {!reports.customerDebtSummary?.topDebtors || reports.customerDebtSummary.topDebtors.length === 0 ? (
                <p style={{ color: "var(--text-muted)", fontSize: 13, margin: "16px 0" }}>
                  No outstanding customer balances. All sales are paid in full.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
                  {reports.customerDebtSummary.topDebtors.map((d, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "8px 12px",
                        background: "var(--bg-surface-muted)",
                        borderRadius: "var(--radius-sm)",
                      }}
                    >
                      <div>
                        <strong style={{ fontSize: 13, display: "block" }}>{d.name}</strong>
                        {d.phone && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>📞 {d.phone}</span>}
                      </div>
                      <span style={{ fontWeight: 700, color: "var(--alert-danger)", fontSize: 13 }}>
                        {formatCurrency(d.totalOutstanding, currency)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top Supplier Payables */}
            <div className="summary-card">
              <div className="summary-card-header">
                <h4>Supplier Payables (Money Owed by Farm)</h4>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  Total: {formatCurrency(reports.supplierPayablesSummary?.totalOutstanding || 0, currency)}
                </span>
              </div>

              {!reports.supplierPayablesSummary?.topSuppliersOwed || reports.supplierPayablesSummary.topSuppliersOwed.length === 0 ? (
                <p style={{ color: "var(--text-muted)", fontSize: 13, margin: "16px 0" }}>
                  No outstanding supplier balances. All vendor purchases are settled.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
                  {reports.supplierPayablesSummary.topSuppliersOwed.map((s, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "8px 12px",
                        background: "var(--bg-surface-muted)",
                        borderRadius: "var(--radius-sm)",
                      }}
                    >
                      <div>
                        <strong style={{ fontSize: 13, display: "block" }}>{s.name}</strong>
                        {s.phone && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>📞 {s.phone}</span>}
                      </div>
                      <span style={{ fontWeight: 700, color: "var(--alert-danger)", fontSize: 13 }}>
                        {formatCurrency(s.totalOutstanding, currency)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ========================================================= */}
      {/* MODALS                                                    */}
      {/* ========================================================= */}

      {/* Transaction Modal (Sale / Expense) */}
      <FinanceTransactionModal
        isOpen={txModalOpen}
        initialType={txModalType}
        initialData={editingItem}
        houses={houses}
        customers={customers}
        suppliers={suppliers}
        breeds={breeds}
        defaultHouseId={houseFilter ? Number(houseFilter) : selectedHouse?.id || null}
        currency={currency}
        onSuccess={handleTxSuccess}
        onCancel={() => {
          setTxModalOpen(false);
          setEditingItem(null);
        }}
        onOpenCustomerModal={() => {
          setTxModalOpen(false);
          setEditingCustomer(null);
          setCustomerModalOpen(true);
        }}
        onOpenSupplierModal={() => {
          setTxModalOpen(false);
          setEditingSupplier(null);
          setSupplierModalOpen(true);
        }}
      />

      {/* Customer Modal */}
      <CustomerModal
        isOpen={customerModalOpen}
        initialData={editingCustomer}
        onSuccess={handleCustomerSuccess}
        onCancel={() => {
          setCustomerModalOpen(false);
          setEditingCustomer(null);
        }}
      />

      {/* Supplier Modal */}
      <SupplierModal
        isOpen={supplierModalOpen}
        initialData={editingSupplier}
        onSuccess={handleSupplierSuccess}
        onCancel={() => {
          setSupplierModalOpen(false);
          setEditingSupplier(null);
        }}
      />

      {/* Customer Financial Profile Modal */}
      <CustomerDetailModal
        isOpen={Boolean(selectedCustomerId)}
        customerId={selectedCustomerId}
        currency={currency}
        onClose={() => setSelectedCustomerId(null)}
        onRecordSale={(cust) => {
          setSelectedCustomerId(null);
          setTxModalType("Income");
          setEditingItem({ customerId: cust.id });
          setTxModalOpen(true);
        }}
      />

      {/* Supplier Financial Profile Modal */}
      <SupplierDetailModal
        isOpen={Boolean(selectedSupplierId)}
        supplierId={selectedSupplierId}
        currency={currency}
        onClose={() => setSelectedSupplierId(null)}
        onRecordExpense={(supp) => {
          setSelectedSupplierId(null);
          setTxModalType("Expense");
          setEditingItem({ supplierId: supp.id, category: "Feed" });
          setTxModalOpen(true);
        }}
      />

      {/* Printable Receipt Modal */}
      <ReceiptModal
        isOpen={Boolean(receiptSale)}
        sale={receiptSale}
        farmName={selectedHouse?.name ? `${selectedHouse.name} • Poultry Farm` : "Poultry Farm Management"}
        currency={currency}
        onClose={() => setReceiptSale(null)}
      />

      {/* Payment Settlement Modal */}
      {paymentTarget && (
        <PaymentModal
          isOpen={Boolean(paymentTarget)}
          target={paymentTarget}
          currency={currency}
          onSuccess={(updated, amt) => {
            setPaymentTarget(null);
            showToast(
              `Payment of ${formatCurrency(amt, currency)} recorded successfully`,
              "success"
            );
            loadFinanceData();
          }}
          onCancel={() => setPaymentTarget(null)}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {deleteTarget && (
        <ConfirmDialog
          title={`Delete ${deleteTarget.type}?`}
          message={
            deleteTarget.type === "Supplier" && deleteTarget.outstanding > 0
              ? `Cannot delete supplier "${deleteTarget.name}" while an outstanding balance of ${formatCurrency(
                  deleteTarget.outstanding,
                  currency
                )} exists. Outstanding payables must be fully settled before this supplier can be removed.`
              : `Are you sure you want to delete this ${deleteTarget.type.toLowerCase()} record (${
                  deleteTarget.name || deleteTarget.category || formatCurrency(deleteTarget.amount, currency)
                })? This cannot be undone.`
          }
          confirmDisabled={deleteTarget.type === "Supplier" && deleteTarget.outstanding > 0}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDeleteConfirm}
          loading={deleting}
        />
      )}
    </div>
  );
}

export default FinancePage;
