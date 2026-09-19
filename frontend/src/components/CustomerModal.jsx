import { useState, useEffect } from "react";
import { createCustomer, updateCustomer } from "../services/api";

function CustomerModal({
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
        notes: initialData.notes || "",
        active: initialData.active !== undefined ? Boolean(initialData.active) : true,
      });
    } else {
      setFormData({
        name: "",
        phone: "",
        email: "",
        address: "",
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
      setError("Customer name is required.");
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
        notes: formData.notes.trim() || null,
        active: formData.active,
      };

      if (isEditing) {
        result = await updateCustomer(initialData.id, payload);
      } else {
        result = await createCustomer(payload);
      }

      onSuccess(result.data, isEditing);
    } catch (err) {
      setError(err.message || "Failed to save customer.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-content" style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <div>
            <h3>{isEditing ? "Edit Customer" : "Add New Customer"}</h3>
            <p className="modal-subtitle">
              Manage buyers, egg wholesale retailers, restaurants, and individuals.
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
            <label htmlFor="cust-name">
              Customer / Business Name <span style={{ color: "var(--alert-danger)" }}>*</span>
            </label>
            <input
              id="cust-name"
              name="name"
              type="text"
              placeholder="e.g. ABC Supermarket, Serrekunda Market Stall #12..."
              value={formData.name}
              onChange={handleChange}
              required
              autoFocus
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="form-group">
              <label htmlFor="cust-phone">Phone Number</label>
              <input
                id="cust-phone"
                name="phone"
                type="tel"
                placeholder="e.g. +220 712 3456"
                value={formData.phone}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label htmlFor="cust-email">Email (Optional)</label>
              <input
                id="cust-email"
                name="email"
                type="email"
                placeholder="e.g. contact@abc.gm"
                value={formData.email}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="cust-address">Location / Address</label>
            <input
              id="cust-address"
              name="address"
              type="text"
              placeholder="e.g. Westfield, Serekunda / Brikama Highway"
              value={formData.address}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label htmlFor="cust-notes">Notes</label>
            <textarea
              id="cust-notes"
              name="notes"
              rows={2}
              placeholder="Preferred delivery days, credit agreements, contact persons..."
              value={formData.notes}
              onChange={handleChange}
            />
          </div>

          {isEditing && (
            <div className="form-group" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                id="cust-active"
                name="active"
                type="checkbox"
                checked={formData.active}
                onChange={handleChange}
              />
              <label htmlFor="cust-active" style={{ marginBottom: 0 }}>
                Active Customer
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
              {saving ? "Saving..." : isEditing ? "Update Customer" : "Create Customer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CustomerModal;
