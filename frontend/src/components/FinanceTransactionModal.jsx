import { useState, useEffect, useContext } from "react";
import { FarmContext } from "../context/farmContextDef";
import {
  createExpense,
  updateExpense,
  createIncome,
  updateIncome,
  getFeedTypes,
  getSuppliers,
} from "../services/api";
import { DEFAULT_CURRENCY, formatCurrency } from "../services/currency";
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
} from "../constants/financeCategories";

export { EXPENSE_CATEGORIES, INCOME_CATEGORIES };

function FinanceTransactionModal({
  isOpen,
  initialType = "Expense", // "Expense" or "Income"
  initialData = null, // if editing
  houses = [],
  customers = [],
  suppliers: propSuppliers = [],
  breeds = [],
  flocks = [],
  defaultHouseId = null,
  defaultFlockId = null,
  defaultCategory = null,
  currency = DEFAULT_CURRENCY,
  onSuccess,
  onCancel,
  onSaved,
  onClose,
  onOpenCustomerModal,
  onOpenSupplierModal,
}) {
  const isEditing = Boolean(initialData?.id);
  const [type, setType] = useState(initialData?.type || initialType);
  const [feedTypes, setFeedTypes] = useState([]);
  const [fetchedSuppliers, setFetchedSuppliers] = useState([]);

  // Feed + unit are locked on a saved purchase that already moved stock
  // (backend enforces this too): changing them would reinterpret the
  // recorded quantity in the new unit.
  const isPurchaseLocked = isEditing && type === "Expense" && initialData?.feedTypeId;

  const suppliers = propSuppliers.length > 0 ? propSuppliers : fetchedSuppliers;
  const handleClose = onCancel || onClose;
  const handleSuccess = onSuccess || onSaved;
  // Cross-page freshness: bump the shared inventory version after any
  // feed-affecting save so InventoryPage refetches (no-op if no provider).
  const farmContext = useContext(FarmContext);
  const notifyFeedInventoryChanged = farmContext?.notifyFeedInventoryChanged || null;

  const [formData, setFormData] = useState({
    category: "",
    customCategory: "",
    customerId: "",
    supplierId: "",
    breedId: "",
    feedTypeId: "",
    quantity: "",
    unit: "",
    unitPrice: "",
    amount: "",
    amountPaid: "",
    date: new Date().toISOString().split("T")[0],
    houseId: "",
    flockId: "",
    description: "",
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successInventory, setSuccessInventory] = useState(null);

  // Load feed types & suppliers on open
  useEffect(() => {
    if (isOpen) {
      getFeedTypes({ active: true })
        .then((res) => {
          if (res.data) setFeedTypes(res.data);
        })
        .catch(() => {});

      if (propSuppliers.length === 0) {
        getSuppliers({ active: true })
          .then((res) => {
            if (res.data) setFetchedSuppliers(res.data);
          })
          .catch(() => {});
      }
    }
  }, [isOpen, propSuppliers.length]);

  // Populate or reset form
  useEffect(() => {
    if (initialData) {
      setType(initialData.type || initialType);
      const isStandardExpense = EXPENSE_CATEGORIES.includes(initialData.category);
      const isStandardIncome = INCOME_CATEGORIES.includes(initialData.category);
      const isStandard = isStandardExpense || isStandardIncome;

      const amt = initialData.amount !== undefined ? String(initialData.amount) : "";
      const paid = initialData.amountPaid !== undefined && initialData.amountPaid !== null
        ? String(initialData.amountPaid)
        : amt;

      setFormData({
        category: isStandard ? initialData.category : "Other",
        customCategory: isStandard ? "" : initialData.category || "",
        customerId: initialData.customerId ? String(initialData.customerId) : "",
        supplierId: initialData.supplierId ? String(initialData.supplierId) : "",
        breedId: initialData.breedId ? String(initialData.breedId) : "",
        feedTypeId: initialData.feedTypeId ? String(initialData.feedTypeId) : "",
        quantity: initialData.quantity !== undefined && initialData.quantity !== null ? String(initialData.quantity) : "",
        unit: initialData.unit || (initialData.category === "Egg sales" ? "trays" : initialData.category?.includes("bird") ? "birds" : initialData.category === "Feed" ? "bags" : ""),
        unitPrice: initialData.unitPrice !== undefined && initialData.unitPrice !== null ? String(initialData.unitPrice) : "",
        amount: amt,
        amountPaid: paid,
        date: initialData.date ? new Date(initialData.date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
        houseId: initialData.houseId ? String(initialData.houseId) : "",
        flockId: initialData.flockId ? String(initialData.flockId) : "",
        description: initialData.description || "",
      });
    } else {
      setType(initialType);
      const chosenCat = defaultCategory || (initialType === "Income" ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0]);
      const defaultUnit = chosenCat === "Egg sales" ? "trays" : chosenCat.includes("bird") ? "birds" : chosenCat === "Feed" ? "bags" : "";

      setFormData({
        category: chosenCat,
        customCategory: "",
        customerId: "",
        supplierId: "",
        breedId: "",
        feedTypeId: "",
        quantity: "",
        unit: defaultUnit,
        unitPrice: "",
        amount: "",
        amountPaid: "",
        date: new Date().toISOString().split("T")[0],
        houseId: defaultHouseId ? String(defaultHouseId) : "",
        flockId: defaultFlockId ? String(defaultFlockId) : "",
        description: "",
      });
    }
    setError("");
    setSuccessInventory(null);
  }, [initialData, initialType, defaultHouseId, defaultFlockId, defaultCategory, isOpen]);

  if (!isOpen) return null;

  if (successInventory) {
    return (
      <div className="modal-backdrop" role="dialog" aria-modal="true">
        <div className="modal-content" style={{ maxWidth: 480 }}>
          <div className="modal-header">
            <div>
              <h3>✓ Purchase Recorded</h3>
              <p className="modal-subtitle">Finance and inventory updated together.</p>
            </div>
            <button type="button" className="modal-close" onClick={handleClose} aria-label="Close">
              ×
            </button>
          </div>
          <div style={{ padding: "0 24px 24px" }}>
            <div style={{ padding: "12px 14px", borderRadius: 8, fontSize: 13, background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Feed Stock</div>
              <div style={{ fontSize: 14, marginBottom: 4 }}>
                <strong>{successInventory.feedName}</strong>
              </div>
              <div>
                +{successInventory.purchaseQty} {successInventory.unit} added
              </div>
              <div>
                {successInventory.stockBefore} → {successInventory.stockAfter} {successInventory.unit}
              </div>
              <div style={{ marginTop: 6, fontSize: 12, color: "#166534" }}>
                ✓ Shared stock increased automatically — no manual adjustment needed
              </div>
            </div>
            <div className="form-actions" style={{ marginTop: 16 }}>
              <button type="button" className="primary-button" onClick={handleClose}>
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentCategories = type === "Income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const isEggSale = type === "Income" && formData.category === "Egg sales";
  const isBirdSale = type === "Income" && (formData.category === "Bird sales" || formData.category === "Spent/layer bird sales");
  const isFeedExpense = type === "Expense" && formData.category === "Feed";

  const handleTypeChange = (newType) => {
    if (isEditing) return;
    setType(newType);
    const defCat = newType === "Income" ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0];
    const defUnit = defCat === "Egg sales" ? "trays" : defCat.includes("bird") ? "birds" : defCat === "Feed" ? "bags" : "";

    setFormData((prev) => ({
      ...prev,
      category: defCat,
      customCategory: "",
      unit: defUnit,
      quantity: "",
      unitPrice: "",
      amount: "",
      amountPaid: "",
    }));
  };

  const handleCategoryChange = (e) => {
    const newCat = e.target.value;
    let defUnit = formData.unit;
    if (newCat === "Egg sales") defUnit = "trays";
    else if (newCat.includes("bird") || newCat === "Bird sales") defUnit = "birds";
    else if (newCat === "Feed") defUnit = "bags";

    setFormData((prev) => ({
      ...prev,
      category: newCat,
      unit: defUnit,
    }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => {
      const next = { ...prev, [name]: value };

      // Auto-calculate Total Amount when quantity or unitPrice changes
      if (name === "quantity" || name === "unitPrice") {
        const q = parseFloat(name === "quantity" ? value : prev.quantity);
        const p = parseFloat(name === "unitPrice" ? value : prev.unitPrice);

        if (!isNaN(q) && q > 0 && !isNaN(p) && p >= 0) {
          const calculatedTotal = Number((q * p).toFixed(2));
          next.amount = String(calculatedTotal);
          // If amountPaid was either empty or equal to previous total, keep it in sync with new total
          if (!prev.amountPaid || prev.amountPaid === prev.amount) {
            next.amountPaid = String(calculatedTotal);
          }
        }
      }

      // If amount directly edited and amountPaid empty, default amountPaid = amount
      if (name === "amount" && (!prev.amountPaid || prev.amountPaid === prev.amount)) {
        next.amountPaid = value;
      }

      return next;
    });
  };

  // Real-time calculation helpers
  const totalAmount = parseFloat(formData.amount) || 0;
  const paidAmount = formData.amountPaid === "" ? totalAmount : parseFloat(formData.amountPaid) || 0;
  const outstandingAmount = Math.max(0, Number((totalAmount - paidAmount).toFixed(2)));

  let derivedStatus = "PAID";
  if (outstandingAmount === 0 || paidAmount >= totalAmount) {
    derivedStatus = "PAID";
  } else if (paidAmount > 0 && paidAmount < totalAmount) {
    derivedStatus = "PARTIALLY_PAID";
  } else {
    derivedStatus = "UNPAID";
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (isNaN(totalAmount) || totalAmount <= 0) {
      setError("Please enter a valid positive total amount.");
      return;
    }

    if (paidAmount < 0) {
      setError("Amount paid cannot be negative.");
      return;
    }

    if (paidAmount > totalAmount) {
      setError("Amount paid cannot exceed total amount.");
      return;
    }

    let finalCategory = formData.category;
    if (finalCategory === "Other" && formData.customCategory.trim()) {
      finalCategory = formData.customCategory.trim();
    }

    if (!finalCategory || !finalCategory.trim()) {
      setError("Category is required.");
      return;
    }

    if (!formData.date) {
      setError("Date is required.");
      return;
    }

    if (type === "Expense" && formData.feedTypeId && formData.quantity && parseFloat(formData.quantity) > 0) {
      const selectedFeed = feedTypes.find((f) => String(f.id) === String(formData.feedTypeId));
      const pUnit = (formData.unit || "").trim().toLowerCase();
      const fUnit = (selectedFeed?.unit || "kg").trim().toLowerCase();
      const isKg = (u) => ["kg", "kgs", "kilogram", "kilograms"].includes(u);
      const isBag = (u) => ["bag", "bags"].includes(u);

      if (!isKg(pUnit) && !isBag(pUnit)) {
        setError(`Unsupported feed unit '${formData.unit}'. Supported units for automatic conversion are 'kg' and 'bags'.`);
        return;
      }

      if ((isBag(pUnit) && isKg(fUnit)) || (isKg(pUnit) && isBag(fUnit)) || isBag(fUnit)) {
        const bagWeight = Number(selectedFeed?.bagWeightKg);
        if (!bagWeight || bagWeight <= 0) {
          setError(`Feed type '${selectedFeed?.name || "Selected"}' does not have a valid bag weight configured for conversion.`);
          return;
        }
      }
    }

    const payload = {
      amount: totalAmount,
      category: finalCategory.trim(),
      date: formData.date,
      houseId: formData.houseId ? Number(formData.houseId) : null,
      flockId: formData.flockId ? Number(formData.flockId) : null,
      description: formData.description ? formData.description.trim() : null,
      quantity: formData.quantity ? parseFloat(formData.quantity) : null,
      unit: formData.unit ? formData.unit.trim() : null,
      unitPrice: formData.unitPrice ? parseFloat(formData.unitPrice) : null,
      amountPaid: paidAmount,
      amountDue: outstandingAmount,
      paymentStatus: derivedStatus,
      customerId: type === "Income" && formData.customerId ? Number(formData.customerId) : null,
      supplierId: type === "Expense" && formData.supplierId ? Number(formData.supplierId) : null,
      feedTypeId: type === "Expense" && formData.feedTypeId ? Number(formData.feedTypeId) : null,
      breedId: formData.breedId ? Number(formData.breedId) : null,
    };

    try {
      setSaving(true);
      let result;

      if (type === "Expense") {
        if (isEditing) {
          result = await updateExpense(initialData.id, payload);
        } else {
          result = await createExpense(payload);
        }
      } else {
        if (isEditing) {
          result = await updateIncome(initialData.id, payload);
        } else {
          result = await createIncome(payload);
        }
      }

      if (handleSuccess) {
        handleSuccess(result.data, type, isEditing);
      }
      if (notifyFeedInventoryChanged) {
        notifyFeedInventoryChanged();
      }
      if (result?.inventory) {
        // Feed purchase: show the automatic stock effect instead of
        // closing immediately, mirroring the daily-record flow.
        setSuccessInventory(result.inventory);
      } else if (handleClose) {
        handleClose();
      }
    } catch (err) {
      setError(err.message || "Failed to save financial record.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-content" style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <div>
            <h3>
              {isEditing ? `Edit ${type}` : type === "Income" ? "Record Sale / Income" : "Record Purchase / Expense"}
            </h3>
            <p className="modal-subtitle">
              {type === "Income"
                ? "Track egg or bird sales, select buyer, and monitor payment status."
                : "Record feed purchases, vendor costs, and outstanding payables."}
            </p>
          </div>
          <button
            type="button"
            className="modal-close"
            onClick={handleClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Type toggle buttons when creating */}
        {!isEditing && (
          <div
            style={{
              display: "flex",
              gap: 8,
              padding: "0 24px",
              marginBottom: 16,
            }}
          >
            <button
              type="button"
              className={`filter-btn ${type === "Income" ? "active" : ""}`}
              onClick={() => handleTypeChange("Income")}
              style={{
                flex: 1,
                padding: "8px 12px",
                borderColor: type === "Income" ? "var(--pine-700)" : undefined,
                fontWeight: type === "Income" ? 700 : 500,
              }}
            >
              💰 Sales & Income (Money In)
            </button>
            <button
              type="button"
              className={`filter-btn ${type === "Expense" ? "active" : ""}`}
              onClick={() => handleTypeChange("Expense")}
              style={{
                flex: 1,
                padding: "8px 12px",
                borderColor: type === "Expense" ? "var(--pine-700)" : undefined,
                fontWeight: type === "Expense" ? 700 : 500,
              }}
            >
              💸 Purchases & Expenses (Money Out)
            </button>
          </div>
        )}

        {error && <div className="form-error" style={{ margin: "0 24px 16px" }}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ padding: "0 24px 24px" }}>
          {/* Customer (for Income) or Supplier (for Expense) */}
          {type === "Income" ? (
            <div className="form-group">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <label htmlFor="tx-customer" style={{ marginBottom: 0 }}>
                  Customer / Buyer
                </label>
                {onOpenCustomerModal && (
                  <button
                    type="button"
                    className="link-subtle"
                    onClick={onOpenCustomerModal}
                    style={{ fontSize: 12, border: "none", background: "none", cursor: "pointer", color: "var(--pine-700)" }}
                  >
                    + Add New Customer
                  </button>
                )}
              </div>
              <select
                id="tx-customer"
                name="customerId"
                value={formData.customerId}
                onChange={handleChange}
              >
                <option value="">Cash / Walk-in Buyer (No profile)</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.phone ? `(${c.phone})` : ""}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="form-group">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <label htmlFor="tx-supplier" style={{ marginBottom: 0 }}>
                  Supplier / Vendor
                </label>
                {onOpenSupplierModal && (
                  <button
                    type="button"
                    className="link-subtle"
                    onClick={onOpenSupplierModal}
                    style={{ fontSize: 12, border: "none", background: "none", cursor: "pointer", color: "var(--pine-700)" }}
                  >
                    + Add New Supplier
                  </button>
                )}
              </div>
              <select
                id="tx-supplier"
                name="supplierId"
                value={formData.supplierId}
                onChange={handleChange}
              >
                <option value="">General Supplier (No profile)</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.category ? `[${s.category}]` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Category selection */}
          <div className="form-group">
            <label htmlFor="tx-category">
              Category <span style={{ color: "var(--alert-danger)" }}>*</span>
            </label>
            <select
              id="tx-category"
              name="category"
              value={formData.category}
              onChange={handleCategoryChange}
              required
            >
              {currentCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Custom Category if "Other" */}
          {formData.category === "Other" && (
            <div className="form-group">
              <label htmlFor="tx-customCategory">Specify Custom Category</label>
              <input
                id="tx-customCategory"
                name="customCategory"
                type="text"
                placeholder="e.g. Solar equipment, packaging crates..."
                value={formData.customCategory}
                onChange={handleChange}
              />
            </div>
          )}

          {/* Feed Variety Dropdown if category is Feed */}
          {type === "Expense" && isFeedExpense && (
            <div className="form-group">
              <label htmlFor="tx-feedTypeId">
                Feed Variety (Increases Inventory Stock)
              </label>
              <select
                id="tx-feedTypeId"
                name="feedTypeId"
                value={formData.feedTypeId}
                disabled={isPurchaseLocked}
                title={isPurchaseLocked ? "Feed is locked on saved purchases — delete and re-record to change it" : undefined}
                onChange={(e) => {
                  const selId = e.target.value;
                  const selectedFeed = feedTypes.find((ft) => String(ft.id) === String(selId));
                  setFormData((prev) => {
                    const next = { ...prev, feedTypeId: selId };
                    if (selectedFeed) {
                      next.unit = selectedFeed.unit || "bags";
                      if (Number(selectedFeed.unitCost) > 0 && (!prev.unitPrice || prev.unitPrice === "0")) {
                        next.unitPrice = String(selectedFeed.unitCost);
                        if (prev.quantity && Number(prev.quantity) > 0) {
                          const calcAmt = Number((Number(prev.quantity) * Number(selectedFeed.unitCost)).toFixed(2));
                          next.amount = String(calcAmt);
                          if (!prev.amountPaid || prev.amountPaid === prev.amount) {
                            next.amountPaid = String(calcAmt);
                          }
                        }
                      }
                    }
                    return next;
                  });
                }}
              >
                <option value="">-- General / Untracked Feed --</option>
                {feedTypes.map((ft) => (
                  <option key={ft.id} value={ft.id}>
                    {ft.name} ({ft.currentStock} {ft.unit} in stock{ft.isLowStock ? " - LOW" : ""})
                  </option>
                ))}
              </select>
              {isPurchaseLocked && (
                <span style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4, display: "block" }}>
                  Locked — stock was already added from this feed and unit. Delete and re-record to change them.
                </span>
              )}
              <span style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4, display: "block" }}>
                Purchased quantity will automatically increase physical stock and log an audit movement.
              </span>
            </div>
          )}

          {/* Unit Pricing Section (Egg sales, Bird sales, Feed purchase, or general unit pricing) */}
          <div
            style={{
              background: "var(--bg-surface-muted)",
              padding: 14,
              borderRadius: "var(--radius-md)",
              marginBottom: 16,
              border: "1px solid var(--border-subtle)",
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 10 }}>
              {isEggSale
                ? "🥚 Egg Quantity & Tray Pricing"
                : isBirdSale
                ? "🐔 Bird Quantity & Pricing"
                : isFeedExpense
                ? "🌾 Feed Bags & Unit Cost"
                : "📦 Quantity & Unit Pricing (Optional)"}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1.2fr", gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, marginBottom: 4, display: "block" }}>
                  {isBirdSale ? "Number of Birds" : "Quantity"}
                </label>
                <input
                  name="quantity"
                  type="number"
                  step="any"
                  min="0"
                  placeholder={isEggSale ? "e.g. 20" : isBirdSale ? "e.g. 25" : isFeedExpense ? "e.g. 50" : "Qty"}
                  value={formData.quantity}
                  onChange={handleChange}
                  style={{ width: "100%", padding: "6px 8px", fontSize: 13 }}
                />
              </div>

              <div>
                <label style={{ fontSize: 11, marginBottom: 4, display: "block" }}>Unit</label>
                {isFeedExpense ? (
                  <select
                    name="unit"
                    value={formData.unit || "bags"}
                    onChange={handleChange}
                    disabled={isPurchaseLocked}
                    title={isPurchaseLocked ? "Unit is locked on saved purchases" : undefined}
                    style={{ width: "100%", padding: "6px 8px", fontSize: 13 }}
                  >
                    <option value="bags">bags</option>
                    <option value="kg">kg</option>
                  </select>
                ) : (
                  <input
                    name="unit"
                    type="text"
                    placeholder={isEggSale ? "trays" : isBirdSale ? "birds" : "unit"}
                    value={formData.unit}
                    onChange={handleChange}
                    style={{ width: "100%", padding: "6px 8px", fontSize: 13 }}
                  />
                )}
              </div>

              <div>
                <label style={{ fontSize: 11, marginBottom: 4, display: "block" }}>
                  Price per Unit ({currency})
                </label>
                <input
                  name="unitPrice"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder={isEggSale ? "e.g. 350" : isBirdSale ? "e.g. 500" : isFeedExpense ? "e.g. 1200" : "0.00"}
                  value={formData.unitPrice}
                  onChange={handleChange}
                  style={{ width: "100%", padding: "6px 8px", fontSize: 13 }}
                />
              </div>
            </div>

            {formData.quantity && formData.unitPrice && (
              <div style={{ marginTop: 8, fontSize: 11, color: "var(--pine-800)", fontStyle: "italic" }}>
                Auto-calculated: {formData.quantity} {formData.unit || "units"} × {formatCurrency(formData.unitPrice, currency)} ={" "}
                <strong>{formatCurrency(formData.amount, currency)}</strong>
              </div>
            )}
          </div>

          {/* Total Amount & Payment Breakdown */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="form-group">
              <label htmlFor="tx-amount">
                Total Amount ({currency}) <span style={{ color: "var(--alert-danger)" }}>*</span>
              </label>
              <input
                id="tx-amount"
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={formData.amount}
                onChange={handleChange}
                required
                style={{ fontSize: 15, fontWeight: 700 }}
              />
            </div>

            <div className="form-group">
              <label htmlFor="tx-paid">
                {type === "Income" ? "Amount Received" : "Amount Paid"} ({currency})
              </label>
              <input
                id="tx-paid"
                name="amountPaid"
                type="number"
                step="0.01"
                min="0"
                max={totalAmount > 0 ? totalAmount : undefined}
                placeholder={formData.amount || "0.00"}
                value={formData.amountPaid}
                onChange={handleChange}
                style={{ fontSize: 15, fontWeight: 600, color: "var(--alert-success)" }}
              />
            </div>
          </div>

          {/* Payment Status & Balance Banner */}
          {totalAmount > 0 && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "8px 12px",
                background:
                  derivedStatus === "PAID"
                    ? "#f0fdf4"
                    : derivedStatus === "PARTIALLY_PAID"
                    ? "#fffbeb"
                    : "#fef2f2",
                border: `1px solid ${
                  derivedStatus === "PAID"
                    ? "#bbf7d0"
                    : derivedStatus === "PARTIALLY_PAID"
                    ? "#fde68a"
                    : "#fecaca"
                }`,
                borderRadius: "var(--radius-sm)",
                marginBottom: 16,
                fontSize: 12,
              }}
            >
              <div>
                <span style={{ color: "var(--text-secondary)" }}>
                  {type === "Income" ? "Buyer Balance Due:" : "Payables Owed to Supplier:"}
                </span>{" "}
                <strong
                  style={{
                    color: outstandingAmount > 0 ? "var(--alert-danger)" : "var(--alert-success)",
                  }}
                >
                  {formatCurrency(outstandingAmount, currency)}
                </strong>
              </div>

              <span
                className={`badge ${
                  derivedStatus === "PAID"
                    ? "badge-healthy"
                    : derivedStatus === "PARTIALLY_PAID"
                    ? "badge-due-soon"
                    : "badge-overdue"
                }`}
                style={{ fontSize: 11, fontWeight: 700 }}
              >
                {derivedStatus}
              </span>
            </div>
          )}

          {/* Date & House Association (plus Breed for Bird Sales) */}
          <div style={{ display: "grid", gridTemplateColumns: isBirdSale && breeds?.length ? "1fr 1fr 1fr" : "1fr 1fr", gap: 12 }}>
            <div className="form-group">
              <label htmlFor="tx-date">
                Date <span style={{ color: "var(--alert-danger)" }}>*</span>
              </label>
              <input
                id="tx-date"
                name="date"
                type="date"
                value={formData.date}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="tx-house">Poultry House</label>
              <select
                id="tx-house"
                name="houseId"
                value={formData.houseId}
                onChange={handleChange}
              >
                <option value="">Whole Farm (General)</option>
                {houses.map((house) => (
                  <option key={house.id} value={house.id}>
                    {house.name}
                  </option>
                ))}
              </select>
            </div>

            {flocks?.length > 0 && (
              <div className="form-group">
                <label htmlFor="tx-flock">Flock / Batch (Optional)</label>
                <select
                  id="tx-flock"
                  name="flockId"
                  value={formData.flockId}
                  onChange={handleChange}
                >
                  <option value="">Not linked to a flock</option>
                  {flocks.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {isBirdSale && breeds?.length > 0 && (
              <div className="form-group">
                <label htmlFor="tx-breed">Breed / Bird Type</label>
                <select
                  id="tx-breed"
                  name="breedId"
                  value={formData.breedId}
                  onChange={handleChange}
                >
                  <option value="">Select Breed (Optional)</option>
                  {breeds.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} {b.type ? `(${b.type})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Notes / Description */}
          <div className="form-group">
            <label htmlFor="tx-description">Description / Notes</label>
            <textarea
              id="tx-description"
              name="description"
              rows={2}
              placeholder="e.g. Wholesale delivery invoice #502, payment received via cash..."
              value={formData.description}
              onChange={handleChange}
            />
          </div>

          <div className="form-actions" style={{ marginTop: 24 }}>
            <button
              type="button"
              className="secondary-button"
              onClick={handleClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="primary-button"
              disabled={saving}
            >
              {saving ? "Saving..." : isEditing ? `Update ${type}` : `Save ${type}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default FinanceTransactionModal;
