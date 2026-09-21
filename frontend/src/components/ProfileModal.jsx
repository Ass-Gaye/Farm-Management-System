import { useState } from "react";
import { updateProfile, changePassword } from "../services/api";

function ProfileModal({ isOpen, onClose, user, onProfileUpdated, showToast }) {
  const [tab, setTab] = useState("profile"); // "profile" | "password"

  const [profileData, setProfileData] = useState({
    name: user?.name || "",
    email: user?.email || "",
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!profileData.name.trim()) {
      setError("Name is required.");
      return;
    }

    if (!profileData.email.trim()) {
      setError("Email is required.");
      return;
    }

    try {
      setSaving(true);
      const res = await updateProfile({
        name: profileData.name.trim(),
        email: profileData.email.trim(),
      });
      onProfileUpdated?.(res.data);
      showToast?.("Profile updated successfully.");
      onClose();
    } catch (err) {
      setError(err.message || "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!passwordData.currentPassword) {
      setError("Current password is required.");
      return;
    }

    if (!passwordData.newPassword || passwordData.newPassword.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError("New password and confirm password do not match.");
      return;
    }

    try {
      setSaving(true);
      await changePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });
      showToast?.("Password changed successfully.");
      setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
      onClose();
    } catch (err) {
      setError(err.message || "Failed to change password.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div
        className="form-card"
        style={{ maxWidth: 440, width: "90%", margin: "40px auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="form-header">
          <div>
            <h2>Account Settings</h2>
            <p>Manage your user credentials and farm profile.</p>
          </div>
          <button type="button" className="close-button" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="auth-tabs" style={{ marginBottom: 16 }}>
          <button
            type="button"
            className={`auth-tab ${tab === "profile" ? "active" : ""}`}
            onClick={() => {
              setTab("profile");
              setError("");
            }}
          >
            Profile Info
          </button>
          <button
            type="button"
            className={`auth-tab ${tab === "password" ? "active" : ""}`}
            onClick={() => {
              setTab("password");
              setError("");
            }}
          >
            Change Password
          </button>
        </div>

        {error && <div className="form-error">{error}</div>}

        {tab === "profile" ? (
          <form onSubmit={handleProfileSubmit}>
            <div className="form-group">
              <label htmlFor="user-name">Full Name</label>
              <input
                id="user-name"
                type="text"
                value={profileData.name}
                onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                autoFocus
              />
            </div>

            <div className="form-group">
              <label htmlFor="user-email">Email Address</label>
              <input
                id="user-email"
                type="email"
                value={profileData.email}
                onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
              />
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={onClose}
                disabled={saving}
              >
                Cancel
              </button>
              <button type="submit" className="primary-button" disabled={saving}>
                {saving ? "Saving..." : "Save Profile"}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handlePasswordSubmit}>
            <div className="form-group">
              <label htmlFor="curr-pwd">Current Password</label>
              <input
                id="curr-pwd"
                type="password"
                placeholder="Enter current password"
                value={passwordData.currentPassword}
                onChange={(e) =>
                  setPasswordData({ ...passwordData, currentPassword: e.target.value })
                }
                autoFocus
              />
            </div>

            <div className="form-group">
              <label htmlFor="new-pwd">New Password</label>
              <input
                id="new-pwd"
                type="password"
                placeholder="At least 6 characters"
                value={passwordData.newPassword}
                onChange={(e) =>
                  setPasswordData({ ...passwordData, newPassword: e.target.value })
                }
              />
            </div>

            <div className="form-group">
              <label htmlFor="confirm-pwd">Confirm New Password</label>
              <input
                id="confirm-pwd"
                type="password"
                placeholder="Re-enter new password"
                value={passwordData.confirmPassword}
                onChange={(e) =>
                  setPasswordData({ ...passwordData, confirmPassword: e.target.value })
                }
              />
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={onClose}
                disabled={saving}
              >
                Cancel
              </button>
              <button type="submit" className="primary-button" disabled={saving}>
                {saving ? "Updating..." : "Change Password"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default ProfileModal;
