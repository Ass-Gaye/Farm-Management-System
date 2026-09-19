import { useState, useEffect } from "react";
import { createExpense, updateExpense, createIncome, updateIncome } from "../services/api";
import { DEFAULT_CURRENCY } from "../services/currency";

export const EXPENSE_CATEGORIES = [
  "Feed",
  "Medication",
  "Vaccines",
  "Labor/staff",
  "Transportation",
  "Electricity",
  "Water",
  "Equipment",
  "Repairs",
  "Poultry house maintenance",
  "Packaging",
  "Other",
];

export const INCOME_CATEGORIES = [
  "Egg sales",
  "Bird sales",
  "Manure sales",
  "Spent/layer bird sales",
  "Other income",
];

function FinanceTransactionModal({
  isOpen,
  initialType = "Expense", // "Expense" or "Income"
  initialData = null, // if editing
  houses = [],
  defaultHouseId = null,
  currency = DEFAULT_CURRENCY,
  onSuccess,
  onCancel,
}) {
  const isEditing = Boolean(initialData?.id);
  const [type, setType] = useState(initialData?.type || initialType);
  const [formData, setFormData] = useState({
    amount: "",
    category: "",
    customCategory: "",
    date: new Date().toISOString().split("T")[0],
    houseId: "",
    description: "",
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (initialData) {
      setType(initialData.type || initialType);
      const isStandardExpense = EXPENSE_CATEGORIES.includes(initialData.category);
      const isStandardIncome = INCOME_CATEGORIES.includes(initialData.category);
      const isStandard = isStandardExpense || isStandardIncome;

      setFormData({
        amount: initialData.amount !== undefined ? String(initialData.amount) : "",
        category: isStandard ? initialData.category : "Other",
        customCategory: isStandard ? "" : initialData.category || "",
        date: initialData.date ? new Date(initialData.date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
        houseId: initialData.houseId ? String(initialData.houseId) : "",
        description: initialData.description || "",
      });
    } else {
      setType(initialType);
      setFormData({
        amount: "",
        category: initialType === "Income" ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0],
        customCategory: "",
        date: new Date().toISOString().split("T")[0],
        houseId: defaultHouseId ? String(defaultHouseId) : "",
        description: "",
      });
    }
    setError("");
  }, [initialData, initialType, defaultHouseId, isOpen]);

  if (!isOpen) return null;

  const currentCategories = type === "Income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const handleTypeChange = (newType) => {
    if (isEditing) return; // Prevent changing type when editing an existing record
    setType(newType);
    setFormData((prev) => ({
      ...prev,
      category: newType === "Income" ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0],
      customCategory: "",
    }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const numericAmount = parseFloat(formData.amount);
    if (!formData.amount || isNaN(numericAmount) || numericAmount <= 0) {
      setError("Please enter a valid positive amount.");
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

    const payload = {
      amount: numericAmount,
      category: finalCategory.trim(),
      date: formData.date,
      houseId: formData.houseId ? Number(formData.houseId) : null,
      description: formData.description ? formData.description.trim() : null,
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

      onSuccess(result.data, type, isEditing);
    } catch (err) {
      setError(err.message || "Failed to save financial record.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-content" style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <div>
            <h3>
              {isEditing ? `Edit ${type}` : `Record ${type}`}
            </h3>
            <p className="modal-subtitle">
              {type === "Expense"
                ? "Record money paid out for feed, supplies, health, or farm operations."
                : "Record money received from poultry sales, eggs, or farm products."}
            </p>
          </div>
          <button
            type="button"
            className="modal-close"
            onClick={onCancel}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Type toggle buttons when creating a new transaction */}
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
              className={`filter-btn ${type === "Expense" ? "active" : ""}`}
              onClick={() => handleTypeChange("Expense")}
              style={{
                flex: 1,
                padding: "8px 12px",
                borderColor: type === "Expense" ? "var(--pine-700)" : undefined,
                fontWeight: type === "Expense" ? 700 : 500,
              }}
            >
              💸 Expense (Money Out)
            </button>
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
              💰 Income (Money In)
            </button>
          </div>
        )}

        {error && <div className="form-error" style={{ margin: "0 24px 16px" }}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ padding: "0 24px 24px" }}>
          {/* Amount input */}
          <div className="form-group">
            <label htmlFor="tx-amount">
              Amount ({currency}) <span style={{ color: "var(--alert-danger)" }}>*</span>
            </label>
            <div style={{ position: "relative" }}>
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
                autoFocus
                style={{ fontSize: 16, fontWeight: 600 }}
              />
            </div>
          </div>

          {/* Category selection */}
          <div className="form-group">
            <label htmlFor="tx-category">
              Category <span style={{ color: "var(--alert-danger)" }}>*</span>
            </label>
            <select
              id="tx-category"
              name="category"
              value={formData.category}
              onChange={handleChange}
              required
            >
              {currentCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Custom category input if 'Other' is chosen */}
          {formData.category === "Other" && (
            <div className="form-group">
              <label htmlFor="tx-customCategory">Specify Custom Category</label>
              <input
                id="tx-customCategory"
                name="customCategory"
                type="text"
                placeholder="e.g. Solar panel maintenance, Packaging crates..."
                value={formData.customCategory}
                onChange={handleChange}
              />
            </div>
          )}

          {/* Date */}
          <div className="form-group">
            <label htmlFor="tx-date">
              Transaction Date <span style={{ color: "var(--alert-danger)" }}>*</span>
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

          {/* House Association */}
          <div className="form-group">
            <label htmlFor="tx-house">Poultry House (Optional)</label>
            <select
              id="tx-house"
              name="houseId"
              value={formData.houseId}
              onChange={handleChange}
            >
              <option value="">Farm-wide / General (No specific house)</option>
              {houses.map((house) => (
                <option key={house.id} value={house.id}>
                  {house.name}
                </option>
              ))}
            </select>
            <span style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4, display: "block" }}>
              Link this transaction to a specific poultry house, or leave as General for whole-farm costs.
            </span>
          </div>

          {/* Description */}
          <div className="form-group">
            <label htmlFor="tx-description">Notes / Description</label>
            <textarea
              id="tx-description"
              name="description"
              rows={2}
              placeholder="e.g. 20 bags layer feed from local mill, invoice #1042..."
              value={formData.description}
              onChange={handleChange}
            />
          </div>

          <div className="form-actions" style={{ marginTop: 24 }}>
            <button
              type="button"
              className="secondary-button"
              onClick={onCancel}
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
