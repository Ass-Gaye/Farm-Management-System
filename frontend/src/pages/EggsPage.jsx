import { useState, useEffect, useMemo, useCallback } from "react";
import { useFarm } from "../context/useFarm";
import PageHeader from "../components/common/PageHeader";
import EmptyState from "../components/common/EmptyState";
import { PlusIcon } from "../components/Icons";
import EggSaleModal from "../components/EggSaleModal";
import EggAdjustmentModal from "../components/EggAdjustmentModal";
import {
  getEggInventory,
  getEggMovements,
  getEggSales,
  deleteEggSale,
  getCustomers,
} from "../services/api";

const MOVEMENT_LABELS = {
  PRODUCTION: "Collected",
  SALE: "Sold",
  ADJUSTMENT: "Adjusted",
  WASTAGE: "Wasted",
  RETURN: "Returned",
  CORRECTION: "Corrected",
};

function EggsPage() {
  const {
    houses = [],
    flocks = [],
    selectedHouse,
    reloadHouseData,
    showToast,
    setConfirmDialog,
    eggInventoryVersion,
    notifyEggInventoryChanged,
  } = useFarm();

  const [stock, setStock] = useState(null);
  const [sales, setSales] = useState([]);
  const [movements, setMovements] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saleModalOpen, setSaleModalOpen] = useState(false);
  const [editingSale, setEditingSale] = useState(null);
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [invRes, salesRes, movRes, custRes] = await Promise.all([
        getEggInventory(),
        getEggSales(),
        getEggMovements({ limit: 100 }),
        getCustomers({ active: true }).catch(() => ({ data: [] })),
      ]);
      if (invRes?.data) setStock(invRes.data);
      if (salesRes?.data) setSales(Array.isArray(salesRes.data) ? salesRes.data : []);
      if (movRes?.data) setMovements(Array.isArray(movRes.data) ? movRes.data : []);
      if (custRes?.data) setCustomers(custRes.data);
    } catch (err) {
      console.error("Failed to fetch egg inventory:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll, eggInventoryVersion]);

  const filteredSales = useMemo(() => {
    if (!searchQuery.trim()) return sales;
    const q = searchQuery.toLowerCase();
    return sales.filter(
      (s) =>
        s.notes?.toLowerCase().includes(q) ||
        s.customer?.name?.toLowerCase().includes(q) ||
        s.income?.customer?.name?.toLowerCase().includes(q) ||
        s.flock?.name?.toLowerCase().includes(q)
    );
  }, [sales, searchQuery]);

  const handleOpenNewSale = () => {
    setEditingSale(null);
    setSaleModalOpen(true);
  };

  const handleOpenEditSale = (sale) => {
    setEditingSale(sale);
    setSaleModalOpen(true);
  };

  const handleSaleSaved = async () => {
    setSaleModalOpen(false);
    await fetchAll();
    await reloadHouseData();
    if (notifyEggInventoryChanged) notifyEggInventoryChanged();
    showToast(editingSale ? "Egg sale updated successfully." : "Egg sale recorded successfully.");
  };

  const handleAdjustmentSaved = async () => {
    setAdjustModalOpen(false);
    await fetchAll();
    showToast("Egg stock adjustment recorded.");
  };

  const handleDeleteSale = (saleId) => {
    setConfirmDialog({
      title: "Delete Egg Sale",
      message:
        "Are you sure you want to delete this egg sale? The sold eggs will be restored to stock and the linked sale income will be removed.",
      confirmLabel: "Delete Sale",
      isDangerous: true,
      onConfirm: async () => {
        try {
          await deleteEggSale(saleId);
          await fetchAll();
          await reloadHouseData();
          if (notifyEggInventoryChanged) notifyEggInventoryChanged();
          showToast("Egg sale deleted. Eggs restored to stock.");
        } catch (err) {
          showToast(err.message || "Failed to delete egg sale.", "error");
        }
      },
    });
  };

  const currentStock = stock?.currentStock ?? 0;

  return (
    <div className="eggs-page">
      <PageHeader
        eyebrow={selectedHouse ? `Poultry House: ${selectedHouse.name}` : undefined}
        title="Egg Inventory & Sales"
        description="Eggs collected enter stock automatically from Daily Records. Sell eggs by the piece — stock, payment and finance update together."
        actions={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="secondary-button" onClick={() => setAdjustModalOpen(true)}>
              Record Breakage / Adjustment
            </button>
            <button type="button" className="primary-button" onClick={handleOpenNewSale}>
              <PlusIcon size={14} /> Record Egg Sale
            </button>
          </div>
        }
      />

      <div className="info-banner" style={{ display: "flex", alignItems: "flex-start", gap: 12, background: "#fefce8", border: "1px solid #fde68a", borderRadius: 8, padding: "14px 18px", marginBottom: 20, color: "#92400e", fontSize: 13, lineHeight: 1.5 }}>
        <div style={{ fontSize: 20, lineHeight: 1 }}>🥚</div>
        <div>
          <strong style={{ display: "block", marginBottom: 2 }}>Egg stock is counted in pieces — not trays, not bags.</strong>
          <span>
            Enter <em>Eggs Collected</em> in your <em>Daily Records</em> and the eggs appear here automatically.
            Feed stock lives separately under <em>Inventory &amp; Feed</em> and is never mixed with eggs.
          </span>
        </div>
      </div>

      <div className="card" style={{ padding: 18, marginBottom: 20, background: "var(--card-bg)", borderRadius: 8, border: "1px solid var(--border-color)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14 }}>
          <div>
            <div className="stat-label">Eggs in Stock</div>
            <div className="stat-value" style={{ fontSize: 34 }}>
              {loading ? "…" : Number(currentStock).toLocaleString()}
              <span style={{ fontSize: 14, color: "var(--text-muted)", marginLeft: 8 }}>eggs</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap", fontSize: 13 }}>
            <span>Collected: <strong>{Number(stock?.totalProduced ?? 0).toLocaleString()}</strong></span>
            <span>Sold: <strong>{Number(stock?.totalSold ?? 0).toLocaleString()}</strong></span>
            <span>Wasted: <strong>{Number(stock?.totalWasted ?? 0).toLocaleString()}</strong></span>
            <span>Adjusted: <strong>{Number(stock?.totalAdjusted ?? 0).toLocaleString()}</strong></span>
            <span>Returned: <strong>{Number(stock?.totalReturned ?? 0).toLocaleString()}</strong></span>
          </div>
        </div>
      </div>

      <div className="records-section">
        <div className="section-toolbar" style={{ flexWrap: "wrap", gap: 12 }}>
          <h3 style={{ margin: 0 }}>Egg Sales</h3>
          <div className="search-input-wrapper">
            <input
              type="text"
              placeholder="Search buyer, flock, or notes..."
              className="table-filter-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ minWidth: 220 }}
            />
            {searchQuery && (
              <button type="button" className="clear-filter-btn" onClick={() => setSearchQuery("")}>
                Clear
              </button>
            )}
          </div>
          <div style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-muted)" }}>
            {filteredSales.length} sale{filteredSales.length === 1 ? "" : "s"} shown
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 30, textAlign: "center", color: "var(--text-secondary)" }}>
            Loading egg sales...
          </div>
        ) : filteredSales.length === 0 ? (
          <EmptyState
            icon="🥚"
            title={searchQuery ? "No matching egg sales found" : "No egg sales recorded yet"}
            message={searchQuery ? "No sales match your search." : "Record an egg sale to reduce stock and create sale income automatically."}
            actionText="+ Record First Egg Sale"
            onAction={handleOpenNewSale}
          />
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th style={{ textAlign: "right" }}>Eggs</th>
                  <th style={{ textAlign: "right" }}>Price / Egg</th>
                  <th>Buyer</th>
                  <th>Financial Link</th>
                  <th>Notes</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSales.map((s) => {
                  const saleDate = new Date(s.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
                  const buyer = s.income?.customer?.name || s.customer?.name;
                  return (
                    <tr key={s.id}>
                      <td><strong>{saleDate}</strong></td>
                      <td style={{ textAlign: "right" }}>
                        <strong style={{ fontSize: 15 }}>{Number(s.quantity).toLocaleString()}</strong>{" "}
                        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>eggs</span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {s.income?.unitPrice ?? s.unitPrice
                          ? `${Number(s.income?.unitPrice ?? s.unitPrice).toLocaleString()} GMD`
                          : <span style={{ color: "var(--text-muted)" }}>—</span>}
                      </td>
                      <td>{buyer ? <strong>{buyer}</strong> : <span style={{ color: "var(--text-muted)", fontSize: 12 }}>Cash buyer</span>}</td>
                      <td>
                        {s.income ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--color-primary)" }}>
                                💰 {Number(s.income.amount).toLocaleString()} GMD
                              </span>
                              <span className={`badge ${s.income.paymentStatus === "PAID" ? "badge-completed" : s.income.paymentStatus === "PARTIALLY_PAID" ? "badge-due-soon" : "badge-overdue"}`} style={{ fontSize: 10, padding: "2px 6px" }}>
                                {s.income.paymentStatus || "PAID"}
                              </span>
                            </div>
                            {Number(s.income.amountDue || 0) > 0 && (
                              <span style={{ fontSize: 11, color: "var(--alert-danger)" }}>
                                Due: {Number(s.income.amountDue).toLocaleString()} GMD
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>No income linked</span>
                        )}
                      </td>
                      <td>{s.notes ? <span>{s.notes}</span> : <span style={{ color: "var(--text-muted)", fontStyle: "italic", fontSize: 12 }}>—</span>}</td>
                      <td style={{ textAlign: "right" }}>
                        <div className="record-actions" style={{ justifyContent: "flex-end", gap: 6 }}>
                          <button type="button" className="secondary-button" style={{ padding: "4px 8px", fontSize: 11 }} onClick={() => handleOpenEditSale(s)}>
                            Edit
                          </button>
                          <button type="button" className="danger-button" style={{ padding: "4px 8px", fontSize: 11 }} onClick={() => handleDeleteSale(s.id)}>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="records-section" style={{ marginTop: 20 }}>
        <div className="section-toolbar">
          <h3 style={{ margin: 0 }}>Egg Movement History</h3>
          <div style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-muted)" }}>
            Every stock change is recorded here
          </div>
        </div>
        {loading ? (
          <div style={{ padding: 30, textAlign: "center", color: "var(--text-secondary)" }}>
            Loading movements...
          </div>
        ) : movements.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
            No egg movements yet. Daily collections, sales, and adjustments will appear here.
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th style={{ textAlign: "right" }}>Eggs</th>
                  <th style={{ textAlign: "right" }}>Stock After</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id}>
                    <td>{new Date(m.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</td>
                    <td>
                      <span className="badge badge-upcoming" style={{ fontSize: 11, fontWeight: 700 }}>
                        {MOVEMENT_LABELS[m.type] || m.type}
                      </span>
                    </td>
                    <td style={{ textAlign: "right", color: Number(m.quantity) < 0 ? "var(--alert-danger)" : "#16a34a", fontWeight: 700 }}>
                      {Number(m.quantity) > 0 ? `+${Number(m.quantity).toLocaleString()}` : Number(m.quantity).toLocaleString()}
                    </td>
                    <td style={{ textAlign: "right" }}><strong>{Number(m.balanceAfter).toLocaleString()}</strong></td>
                    <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                      {m.reason || "—"}
                      {m.house?.name ? ` · ${m.house.name}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <EggSaleModal
        isOpen={saleModalOpen}
        onClose={() => setSaleModalOpen(false)}
        onSaved={handleSaleSaved}
        sale={editingSale}
        houses={houses}
        flocks={flocks}
        customers={customers}
        currentStock={currentStock}
      />
      <EggAdjustmentModal
        isOpen={adjustModalOpen}
        onClose={() => setAdjustModalOpen(false)}
        onSaved={handleAdjustmentSaved}
        currentStock={currentStock}
        houses={houses}
      />
    </div>
  );
}

export default EggsPage;
