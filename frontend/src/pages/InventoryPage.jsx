import { useState, useEffect, useMemo } from "react";
import { useFarm } from "../context/useFarm";
import {
  getFeedTypes,
  deleteFeedType,
  getInventorySummary,
  getInventoryMovements,
} from "../services/api";
import { formatCurrency } from "../services/currency";
import FeedTypeModal from "../components/FeedTypeModal";
import StockAdjustmentModal from "../components/StockAdjustmentModal";
import FinanceTransactionModal from "../components/FinanceTransactionModal";
import ConfirmDialog from "../components/ConfirmDialog";
import LoadingState from "../components/common/LoadingState";
import EmptyState from "../components/common/EmptyState";
import {
  InventoryIcon,
  FeedIcon,
  PlusIcon,
  EditIcon,
  TrashIcon,
  SearchIcon,
  AlertIcon,
} from "../components/Icons";

function InventoryPage() {
  const { houses } = useFarm();

  const [activeTab, setActiveTab] = useState("stocks"); // "stocks" | "movements" | "reorder"
  const [feedTypes, setFeedTypes] = useState([]);
  const [summary, setSummary] = useState(null);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Modals state
  const [isFeedTypeModalOpen, setIsFeedTypeModalOpen] = useState(false);
  const [editingFeedType, setEditingFeedType] = useState(null);
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  const [adjustmentFeedId, setAdjustmentFeedId] = useState(null);
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [deleteConfirmFeed, setDeleteConfirmFeed] = useState(null);

  // Filters
  const [stockSearch, setStockSearch] = useState("");
  const [movementTypeFilter, setMovementTypeFilter] = useState("all");
  const [movementFeedFilter, setMovementFeedFilter] = useState("all");

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");

      const [feedsRes, summaryRes, movementsRes] = await Promise.all([
        getFeedTypes(),
        getInventorySummary(),
        getInventoryMovements({ limit: 100 }),
      ]);

      setFeedTypes(feedsRes.data || []);
      setSummary(summaryRes.data || null);
      setMovements(movementsRes.data?.movements || []);
    } catch (err) {
      setError(err.message || "Failed to load inventory data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenAddFeed = () => {
    setEditingFeedType(null);
    setIsFeedTypeModalOpen(true);
  };

  const handleOpenEditFeed = (feed) => {
    setEditingFeedType(feed);
    setIsFeedTypeModalOpen(true);
  };

  const handleOpenAdjustment = (feedId = null) => {
    setAdjustmentFeedId(feedId);
    setIsAdjustmentModalOpen(true);
  };

  const handleDeleteFeed = async () => {
    if (!deleteConfirmFeed) return;
    try {
      await deleteFeedType(deleteConfirmFeed.id);
      setDeleteConfirmFeed(null);
      await loadData();
    } catch (err) {
      setError(err.message || "Failed to delete feed type");
    }
  };

  // Filtered feed types
  const filteredFeedTypes = useMemo(() => {
    return feedTypes.filter((ft) => {
      if (!stockSearch) return true;
      const term = stockSearch.toLowerCase();
      return (
        ft.name.toLowerCase().includes(term) ||
        (ft.category && ft.category.toLowerCase().includes(term)) ||
        (ft.description && ft.description.toLowerCase().includes(term))
      );
    });
  }, [feedTypes, stockSearch]);

  // Low stock items
  const lowStockItems = useMemo(() => {
    return feedTypes.filter((ft) => ft.isLowStock && ft.active);
  }, [feedTypes]);

  // Filtered movements
  const filteredMovements = useMemo(() => {
    return movements.filter((m) => {
      if (movementTypeFilter !== "all" && m.type !== movementTypeFilter) {
        return false;
      }
      if (
        movementFeedFilter !== "all" &&
        String(m.feedTypeId) !== String(movementFeedFilter)
      ) {
        return false;
      }
      return true;
    });
  }, [movements, movementTypeFilter, movementFeedFilter]);

  const getMovementBadge = (type) => {
    switch (type) {
      case "PURCHASE":
        return <span className="badge badge-success">PURCHASE</span>;
      case "CONSUMPTION":
        return <span className="badge badge-primary">CONSUMPTION</span>;
      case "ADJUSTMENT":
        return <span className="badge badge-warning">ADJUSTMENT</span>;
      case "WASTAGE":
        return <span className="badge badge-danger">WASTAGE</span>;
      case "RETURN":
        return <span className="badge badge-secondary">RETURN</span>;
      default:
        return <span className="badge">{type}</span>;
    }
  };

  if (loading && feedTypes.length === 0) {
    return <LoadingState message="Loading inventory & feed stocks..." />;
  }

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: "20px" }}>
        <div>
          <h1 style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <FeedIcon size={26} />
            Inventory & Feed Management
          </h1>
          <p className="text-muted">
            Track feed stock levels, log feed purchases, monitor daily consumption, and record physical adjustments.
          </p>
        </div>
        <div className="header-actions" style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => handleOpenAdjustment()}
          >
            Adjust / Wastage
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setIsPurchaseModalOpen(true)}
          >
            + Feed Purchase
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleOpenAddFeed}
          >
            <PlusIcon size={16} />
            Add Feed Type
          </button>
        </div>
      </div>

      {error && <div className="alert-banner alert-error mb-4">{error}</div>}

      {/* Low Stock Alert Banner */}
      {lowStockItems.length > 0 && (
        <div
          className="alert-banner alert-warning mb-4"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#fffbeb",
            border: "1px solid #fde68a",
            color: "#92400e",
            padding: "12px 16px",
            borderRadius: "8px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <AlertIcon size={20} />
            <div>
              <strong>Low Stock Alert:</strong> The following feed items are below minimum threshold:{" "}
              {lowStockItems.map((item) => (
                <span key={item.id} style={{ fontWeight: 600 }}>
                  {item.name} ({item.currentStock} {item.unit} / min {item.minimumStock} {item.unit})
                  {lowStockItems.length > 1 ? "; " : ""}
                </span>
              ))}
            </div>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={() => setIsPurchaseModalOpen(true)}
            style={{ whiteSpace: "nowrap" }}
          >
            Reorder Stock
          </button>
        </div>
      )}

      {/* KPI Summary Cards */}
      <div className="kpi-grid mb-4" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-label">Feed Types</span>
            <FeedIcon size={18} className="text-muted" />
          </div>
          <div className="stat-value">{feedTypes.length}</div>
          <div className="stat-subtext">Active feed varieties</div>
        </div>

        <div className={`stat-card ${lowStockItems.length > 0 ? "stat-card-warning" : ""}`}>
          <div className="stat-card-header">
            <span className="stat-label">Low Stock Alerts</span>
            <AlertIcon size={18} style={{ color: lowStockItems.length > 0 ? "#dc2626" : "#64748b" }} />
          </div>
          <div className="stat-value" style={{ color: lowStockItems.length > 0 ? "#dc2626" : "inherit" }}>
            {lowStockItems.length}
          </div>
          <div className="stat-subtext">
            {lowStockItems.length > 0 ? "Items require reorder" : "All stocks healthy"}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-label">Total Inventory Value</span>
            <span style={{ fontSize: "12px", color: "#64748b" }}>GMD</span>
          </div>
          <div className="stat-value">
            {formatCurrency(summary?.totalValuation || 0)}
          </div>
          <div className="stat-subtext">Current on-hand valuation</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-label">Recent Movements</span>
            <InventoryIcon size={18} className="text-muted" />
          </div>
          <div className="stat-value">{movements.length}</div>
          <div className="stat-subtext">Logged audit records</div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="tabs-nav mb-4" style={{ borderBottom: "1px solid #e2e8f0" }}>
        <button
          type="button"
          className={`tab-button ${activeTab === "stocks" ? "active" : ""}`}
          onClick={() => setActiveTab("stocks")}
        >
          <FeedIcon size={16} />
          Feed Stocks & Types ({feedTypes.length})
        </button>
        <button
          type="button"
          className={`tab-button ${activeTab === "movements" ? "active" : ""}`}
          onClick={() => setActiveTab("movements")}
        >
          <InventoryIcon size={16} />
          Movement History ({movements.length})
        </button>
        <button
          type="button"
          className={`tab-button ${activeTab === "reorder" ? "active" : ""}`}
          onClick={() => setActiveTab("reorder")}
        >
          <AlertIcon size={16} />
          Low Stock Items
          {lowStockItems.length > 0 && (
            <span className="tab-badge" style={{ background: "#dc2626", color: "#fff" }}>
              {lowStockItems.length}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: Feed Stocks & Types */}
      {activeTab === "stocks" && (
        <div className="card">
          <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
            <h3 style={{ margin: 0 }}>Feed Stock Levels</h3>
            <div className="search-bar" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ position: "relative" }}>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search feed types..."
                  value={stockSearch}
                  onChange={(e) => setStockSearch(e.target.value)}
                  style={{ paddingLeft: "30px", width: "220px" }}
                />
                <SearchIcon
                  size={14}
                  style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }}
                />
              </div>
            </div>
          </div>

          {filteredFeedTypes.length === 0 ? (
            <EmptyState
              icon={<FeedIcon size={40} />}
              title="No feed types found"
              message={
                stockSearch
                  ? "No feed types matched your search criteria."
                  : "Start by adding your first feed variety (e.g. Layer Feed, Broiler Starter)."
              }
              actionLabel={!stockSearch ? "+ Add Feed Type" : null}
              onAction={handleOpenAddFeed}
            />
          ) : (
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Feed Name</th>
                    <th>Category</th>
                    <th>Current Stock</th>
                    <th>Minimum Stock</th>
                    <th>Status</th>
                    <th>Unit Cost</th>
                    <th>Valuation</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFeedTypes.map((ft) => (
                    <tr key={ft.id}>
                      <td>
                        <strong>{ft.name}</strong>
                        {ft.description && (
                          <div className="text-muted text-xs">{ft.description}</div>
                        )}
                      </td>
                      <td>
                        <span className="badge badge-secondary">{ft.category || "FEED"}</span>
                      </td>
                      <td>
                        <strong style={{ fontSize: "15px" }}>
                          {ft.currentStock} {ft.unit}
                        </strong>
                        {ft.unit.toLowerCase().includes("bag") && ft.bagWeightKg && (
                          <span className="text-muted text-xs ml-1">
                            ({ft.currentStock * ft.bagWeightKg} kg)
                          </span>
                        )}
                      </td>
                      <td>
                        {ft.minimumStock} {ft.unit}
                      </td>
                      <td>
                        {ft.isLowStock ? (
                          <span className="badge badge-danger" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            <AlertIcon size={12} /> LOW STOCK
                          </span>
                        ) : (
                          <span className="badge badge-success">OK</span>
                        )}
                      </td>
                      <td>{formatCurrency(ft.unitCost)}</td>
                      <td>
                        <strong>{formatCurrency(ft.totalValuation)}</strong>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: "6px" }}>
                          <button
                            type="button"
                            className="btn btn-sm btn-secondary"
                            onClick={() => handleOpenAdjustment(ft.id)}
                            title="Adjust physical stock"
                          >
                            Adjust
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-icon"
                            onClick={() => handleOpenEditFeed(ft)}
                            title="Edit feed type"
                          >
                            <EditIcon size={15} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-icon text-danger"
                            onClick={() => setDeleteConfirmFeed(ft)}
                            title="Delete feed type"
                          >
                            <TrashIcon size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Movement History */}
      {activeTab === "movements" && (
        <div className="card">
          <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
            <h3 style={{ margin: 0 }}>Inventory Audit Log</h3>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <select
                className="form-control"
                value={movementFeedFilter}
                onChange={(e) => setMovementFeedFilter(e.target.value)}
                style={{ width: "180px" }}
              >
                <option value="all">All Feed Types</option>
                {feedTypes.map((ft) => (
                  <option key={ft.id} value={ft.id}>
                    {ft.name}
                  </option>
                ))}
              </select>

              <select
                className="form-control"
                value={movementTypeFilter}
                onChange={(e) => setMovementTypeFilter(e.target.value)}
                style={{ width: "160px" }}
              >
                <option value="all">All Types</option>
                <option value="PURCHASE">PURCHASE (+)</option>
                <option value="CONSUMPTION">CONSUMPTION (-)</option>
                <option value="ADJUSTMENT">ADJUSTMENT</option>
                <option value="WASTAGE">WASTAGE (-)</option>
                <option value="RETURN">RETURN</option>
              </select>
            </div>
          </div>

          {filteredMovements.length === 0 ? (
            <EmptyState
              icon={<InventoryIcon size={40} />}
              title="No movements recorded"
              message="Stock additions, daily feed consumption, and manual adjustments will appear here."
            />
          ) : (
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Feed Variety</th>
                    <th>Movement Type</th>
                    <th>Quantity Change</th>
                    <th>Remaining Stock</th>
                    <th>Details / Reference</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMovements.map((m) => {
                    const isPositive = Number(m.quantity) > 0;
                    return (
                      <tr key={m.id}>
                        <td style={{ whiteSpace: "nowrap" }}>
                          {new Date(m.date).toLocaleDateString()}
                        </td>
                        <td>
                          <strong>{m.feedType?.name || "Feed Item"}</strong>
                        </td>
                        <td>{getMovementBadge(m.type)}</td>
                        <td>
                          <span
                            style={{
                              fontWeight: 600,
                              color: isPositive ? "#16a34a" : "#dc2626",
                            }}
                          >
                            {isPositive ? `+${m.quantity}` : m.quantity} {m.unit}
                          </span>
                        </td>
                        <td>
                          <strong>
                            {m.balanceAfter} {m.unit}
                          </strong>
                        </td>
                        <td>
                          <span className="text-muted text-sm">
                            {m.reason ||
                              (m.type === "PURCHASE"
                                ? m.expense?.supplier
                                  ? `Purchased from ${m.expense.supplier.name}`
                                  : "Feed purchase"
                                : m.type === "CONSUMPTION"
                                ? m.house
                                  ? `Consumed in ${m.house.name}`
                                  : "Daily consumption"
                                : "Manual update")}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Low Stock Items & Reorder */}
      {activeTab === "reorder" && (
        <div className="card">
          <div className="card-header">
            <h3 style={{ margin: 0 }}>Low Stock Replenishment</h3>
          </div>

          {lowStockItems.length === 0 ? (
            <EmptyState
              icon={<FeedIcon size={40} />}
              title="All stock levels are optimal!"
              message="No feed varieties are currently below their minimum threshold."
            />
          ) : (
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Feed Name</th>
                    <th>Current Stock</th>
                    <th>Minimum Threshold</th>
                    <th>Deficit</th>
                    <th>Est. Reorder Cost</th>
                    <th style={{ textAlign: "right" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStockItems.map((item) => {
                    const deficit = Math.max(0, item.minimumStock - item.currentStock);
                    const estReorderQty = Math.max(deficit, item.minimumStock);
                    const estCost = estReorderQty * Number(item.unitCost || 0);

                    return (
                      <tr key={item.id}>
                        <td>
                          <strong>{item.name}</strong>
                          <div className="text-muted text-xs">{item.category}</div>
                        </td>
                        <td style={{ color: "#dc2626", fontWeight: 700 }}>
                          {item.currentStock} {item.unit}
                        </td>
                        <td>
                          {item.minimumStock} {item.unit}
                        </td>
                        <td>
                          <span className="badge badge-danger">
                            -{deficit} {item.unit}
                          </span>
                        </td>
                        <td>
                          {formatCurrency(estCost)}
                          <span className="text-muted text-xs ml-1">
                            (~{estReorderQty} {item.unit})
                          </span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            onClick={() => setIsPurchaseModalOpen(true)}
                          >
                            Order Feed
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Feed Type Modal */}
      <FeedTypeModal
        isOpen={isFeedTypeModalOpen}
        onClose={() => setIsFeedTypeModalOpen(false)}
        onSaved={loadData}
        feedType={editingFeedType}
      />

      {/* Stock Adjustment Modal */}
      <StockAdjustmentModal
        isOpen={isAdjustmentModalOpen}
        onClose={() => setIsAdjustmentModalOpen(false)}
        onSaved={loadData}
        feedTypes={feedTypes}
        selectedFeedId={adjustmentFeedId}
        houses={houses}
      />

      {/* Quick Feed Purchase Modal (via existing Finance Transaction modal) */}
      <FinanceTransactionModal
        isOpen={isPurchaseModalOpen}
        onClose={() => setIsPurchaseModalOpen(false)}
        onSaved={loadData}
        type="expense"
        houses={houses}
        defaultCategory="Feed"
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deleteConfirmFeed)}
        title="Remove Feed Type"
        message={`Are you sure you want to remove "${deleteConfirmFeed?.name}"? If historical records exist, it will be safely deactivated instead of deleted.`}
        confirmText="Remove"
        onConfirm={handleDeleteFeed}
        onCancel={() => setDeleteConfirmFeed(null)}
      />
    </div>
  );
}

export default InventoryPage;
