import { useState } from "react";
import { loginUser, registerUser, forgotPassword, resetPassword } from "../services/api";

function AuthModal({ onSuccess }) {
  // mode: "login" | "register" | "forgot" | "reset"
  const [mode, setMode] = useState("login");

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    resetToken: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleDemoFill = () => {
    setMode("login");
    setFormData((prev) => ({
      ...prev,
      name: "",
      email: "farmer@poultry.local",
      password: "Farm@123456",
    }));
    setError("");
    setSuccessMessage("");
  };

  const handleSwitchMode = (newMode) => {
    setMode(newMode);
    setError("");
    setSuccessMessage("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    if (mode === "register") {
      if (!formData.name.trim()) {
        setError("Full name is required.");
        return;
      }
      if (!formData.email.trim()) {
        setError("Email address is required.");
        return;
      }
      if (!formData.password || formData.password.length < 6) {
        setError("Password must be at least 6 characters.");
        return;
      }

      try {
        setLoading(true);
        const result = await registerUser({
          name: formData.name.trim(),
          email: formData.email.trim(),
          password: formData.password,
        });
        onSuccess(result.data.user);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    } else if (mode === "login") {
      if (!formData.email.trim()) {
        setError("Email address is required.");
        return;
      }
      if (!formData.password) {
        setError("Password is required.");
        return;
      }

      try {
        setLoading(true);
        const result = await loginUser({
          email: formData.email.trim(),
          password: formData.password,
        });
        onSuccess(result.data.user);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    } else if (mode === "forgot") {
      if (!formData.email.trim()) {
        setError("Email address is required.");
        return;
      }

      try {
        setLoading(true);
        const result = await forgotPassword({ email: formData.email.trim() });
        setSuccessMessage(result.message || "Password reset token generated.");
        if (result.data?.resetToken) {
          setFormData((prev) => ({
            ...prev,
            resetToken: result.data.resetToken,
          }));
          // Transition to reset view automatically after a brief moment or directly
          setMode("reset");
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    } else if (mode === "reset") {
      if (!formData.resetToken.trim()) {
        setError("Password reset token is required.");
        return;
      }
      if (!formData.newPassword || formData.newPassword.length < 6) {
        setError("New password must be at least 6 characters long.");
        return;
      }
      if (formData.newPassword !== formData.confirmPassword) {
        setError("New passwords do not match.");
        return;
      }

      try {
        setLoading(true);
        const result = await resetPassword({
          token: formData.resetToken.trim(),
          newPassword: formData.newPassword,
        });
        setSuccessMessage(result.message || "Password reset successful. Please sign in.");
        setFormData((prev) => ({
          ...prev,
          password: "",
          newPassword: "",
          confirmPassword: "",
          resetToken: "",
        }));
        setMode("login");
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="auth-overlay">
      <div className="auth-modal">
        <div className="auth-header">
          <div className="auth-logo">🐔</div>
          <h2>Poultry Management System</h2>
          <p>
            {mode === "register"
              ? "Create a farm manager account to manage your houses"
              : mode === "forgot"
              ? "Enter your email to receive password reset instructions"
              : mode === "reset"
              ? "Set a new secure password for your farm account"
              : "Sign in to access your poultry houses and farm data"}
          </p>
        </div>

        {/* Tab switcher only when in login or register mode */}
        {(mode === "login" || mode === "register") && (
          <div className="auth-tabs">
            <button
              type="button"
              className={`auth-tab ${mode === "login" ? "active" : ""}`}
              onClick={() => handleSwitchMode("login")}
            >
              Sign In
            </button>
            <button
              type="button"
              className={`auth-tab ${mode === "register" ? "active" : ""}`}
              onClick={() => handleSwitchMode("register")}
            >
              Create Account
            </button>
          </div>
        )}

        {error && <div className="form-error">{error}</div>}
        {successMessage && (
          <div
            className="form-success"
            style={{
              background: "#ecfdf5",
              border: "1px solid #a7f3d0",
              color: "#065f46",
              padding: "10px 14px",
              borderRadius: "6px",
              fontSize: "13px",
              marginBottom: "16px",
            }}
          >
            {successMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          {mode === "register" && (
            <div className="form-group">
              <label htmlFor="auth-name">Full Name</label>
              <input
                id="auth-name"
                name="name"
                type="text"
                placeholder="e.g. Assan Gaye"
                value={formData.name}
                onChange={handleChange}
                autoFocus
              />
            </div>
          )}

          {(mode === "login" || mode === "register" || mode === "forgot") && (
            <div className="form-group">
              <label htmlFor="auth-email">Email Address</label>
              <input
                id="auth-email"
                name="email"
                type="email"
                placeholder="e.g. manager@farm.com"
                value={formData.email}
                onChange={handleChange}
                autoFocus={mode === "login" || mode === "forgot"}
              />
            </div>
          )}

          {(mode === "login" || mode === "register") && (
            <div className="form-group">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label htmlFor="auth-password">Password</label>
                {mode === "login" && (
                  <button
                    type="button"
                    className="link-button"
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--color-primary)",
                      fontSize: "12px",
                      cursor: "pointer",
                      padding: 0,
                    }}
                    onClick={() => handleSwitchMode("forgot")}
                  >
                    Forgot Password?
                  </button>
                )}
              </div>
              <input
                id="auth-password"
                name="password"
                type="password"
                placeholder={mode === "register" ? "At least 6 characters" : "Enter your password"}
                value={formData.password}
                onChange={handleChange}
              />
            </div>
          )}

          {mode === "reset" && (
            <>
              <div className="form-group">
                <label htmlFor="auth-token">Reset Token</label>
                <input
                  id="auth-token"
                  name="resetToken"
                  type="text"
                  placeholder="Paste or enter reset token"
                  value={formData.resetToken}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label htmlFor="auth-new-password">New Password</label>
                <input
                  id="auth-new-password"
                  name="newPassword"
                  type="password"
                  placeholder="At least 6 characters"
                  value={formData.newPassword}
                  onChange={handleChange}
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label htmlFor="auth-confirm-password">Confirm New Password</label>
                <input
                  id="auth-confirm-password"
                  name="confirmPassword"
                  type="password"
                  placeholder="Re-type new password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                />
              </div>
            </>
          )}

          <div className="auth-actions">
            <button
              type="submit"
              className="primary-button submit-btn"
              disabled={loading}
            >
              {loading
                ? "Processing..."
                : mode === "register"
                ? "Create Account"
                : mode === "forgot"
                ? "Request Password Reset"
                : mode === "reset"
                ? "Set New Password"
                : "Sign In"}
            </button>

            {mode === "login" && (
              <button
                type="button"
                className="demo-button"
                onClick={handleDemoFill}
              >
                Use Demo Farm Account (farmer@poultry.local)
              </button>
            )}

            {mode === "forgot" && (
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "8px", fontSize: "12px" }}>
                <button
                  type="button"
                  className="link-button"
                  style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer" }}
                  onClick={() => handleSwitchMode("login")}
                >
                  ← Back to Sign In
                </button>
                <button
                  type="button"
                  className="link-button"
                  style={{ background: "none", border: "none", color: "var(--color-primary)", cursor: "pointer" }}
                  onClick={() => handleSwitchMode("reset")}
                >
                  Already have a token? Reset here →
                </button>
              </div>
            )}

            {mode === "reset" && (
              <div style={{ textAlign: "center", marginTop: "8px", fontSize: "12px" }}>
                <button
                  type="button"
                  className="link-button"
                  style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer" }}
                  onClick={() => handleSwitchMode("login")}
                >
                  ← Back to Sign In
                </button>
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

export default AuthModal;
