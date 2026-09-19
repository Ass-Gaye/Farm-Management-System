import { useState, useEffect } from "react";
import { createSupplier, updateSupplier } from "../services/api";

const SUPPLIER_CATEGORIES = [
  "Feed",
  "Medication & Vaccines",
  "Chicks & Breeders",
  "Equipment & Hardware",
  "Veterinary Services",
  "Packaging & Crates",
  "General Farm Supplies",
  "Other",
];

function SupplierModal({
  isOpen,
  initialData = null,
  onSuccess,
  onCancel,
}) {
  const isEditing = Boolean(initialData?.id);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    category: SUPPLIER_CATEGORIES[0],
    notes: "",
    active: true,
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || "",
        phone: initialData.phone || "",
        email: initialData.email || "",
        address: initialData.address || "",
        category: initialData.category || SUPPLIER_CATEGORIES[0],
        notes: initialData.notes || "",
        active: initialData.active !== undefined ? Boolean(initialData.active) : true,
      });
    } else {
      setFormData({
        name: "",
        phone: "",
        email: "",
        address: "",
        category: SUPPLIER_CATEGORIES[0],
        notes: "",
        active: true,
      });
    }
    setError("");
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!formData.name.trim()) {
      setError("Supplier name is required.");
      return;
    }

    try {
      setSaving(true);
      let result;
      const payload = {
        name: formData.name.trim(),
        phone: formData.phone.trim() || null,
        email: formData.email.trim() || null,
        address: formData.address.trim() || null,
        category: formData.category ? formData.category.trim() : null,
        notes: formData.notes.trim() || null,
        active: formData.active,
      };

      if (isEditing) {
        result = await updateSupplier(initialData.id, payload);
      } else {
        result = await createSupplier(payload);
      }

      onSuccess(result.data, isEditing);
    } catch (err) {
      setError(err.message || "Failed to save supplier.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-content" style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <div>
            <h3>{isEditing ? "Edit Supplier" : "Add New Supplier"}</h3>
            <p className="modal-subtitle">
              Record feed vendors, medication suppliers, and equipment partners.
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

        {error && <div className="form-error" style={{ margin: "0 24px 16px" }}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ padding: "0 24px 24px" }}>
          <div className="form-group">
            <label htmlFor="supp-name">
              Supplier / Company Name <span style={{ color: "var(--alert-danger)" }}>*</span>
            </label>
            <input
              id="supp-name"
              name="name"
              type="text"
              placeholder="e.g. ABC Feed Mill, Quality Vet Supplies..."
              value={formData.name}
              onChange={handleChange}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="supp-category">Supplier Category</label>
            <select
              id="supp-category"
              name="category"
              value={formData.category}
              onChange={handleChange}
            >
              {SUPPLIER_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="form-group">
              <label htmlFor="supp-phone">Phone Number</label>
              <input
                id="supp-phone"
                name="phone"
                type="tel"
                placeholder="e.g. +220 987 6543"
                value={formData.phone}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label htmlFor="supp-email">Email (Optional)</label>
              <input
                id="supp-email"
                name="email"
                type="email"
                placeholder="e.g. sales@feedmill.gm"
                value={formData.email}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="supp-address">Location / Address</label>
            <input
              id="supp-address"
              name="address"
              type="text"
              placeholder="e.g. Industrial Area, Kanifing"
              value={formData.address}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label htmlFor="supp-notes">Notes</label>
            <textarea
              id="supp-notes"
              name="notes"
              rows={2}
              placeholder="Payment terms, delivery schedules, representative name..."
              value={formData.notes}
              onChange={handleChange}
            />
          </div>

          {isEditing && (
            <div className="form-group" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                id="supp-active"
                name="active"
                type="checkbox"
                checked={formData.active}
                onChange={handleChange}
              />
              <label htmlFor="supp-active" style={{ marginBottom: 0 }}>
                Active Supplier
              </label>
            </div>
          )}

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
              {saving ? "Saving..." : isEditing ? "Update Supplier" : "Create Supplier"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default SupplierModal;
