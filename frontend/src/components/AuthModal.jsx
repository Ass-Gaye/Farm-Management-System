import { useState } from "react";
import { loginUser, registerUser } from "../services/api";

function AuthModal({ onSuccess }) {
  const [isRegister, setIsRegister] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleDemoFill = () => {
    setIsRegister(false);
    setFormData({
      name: "",
      email: "farmer@poultry.local",
      password: "Farm@123456",
    });
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (isRegister && !formData.name.trim()) {
      setError("Full name is required.");
      return;
    }

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
      let result;
      if (isRegister) {
        result = await registerUser({
          name: formData.name.trim(),
          email: formData.email.trim(),
          password: formData.password,
        });
      } else {
        result = await loginUser({
          email: formData.email.trim(),
          password: formData.password,
        });
      }
      onSuccess(result.data.user);
    } catch (err) {
      setError(err.message || "Authentication failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-overlay">
      <div className="auth-modal">
        <div className="auth-header">
          <div className="auth-logo">🐔</div>
          <h2>Poultry Management System</h2>
          <p>
            {isRegister
              ? "Create a farm manager account to manage your houses"
              : "Sign in to access your poultry houses and farm data"}
          </p>
        </div>

        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab ${!isRegister ? "active" : ""}`}
            onClick={() => {
              setIsRegister(false);
              setError("");
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`auth-tab ${isRegister ? "active" : ""}`}
            onClick={() => {
              setIsRegister(true);
              setError("");
            }}
          >
            Create Account
          </button>
        </div>

        {error && <div className="form-error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          {isRegister && (
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

          <div className="form-group">
            <label htmlFor="auth-email">Email Address</label>
            <input
              id="auth-email"
              name="email"
              type="email"
              placeholder="e.g. manager@farm.com"
              value={formData.email}
              onChange={handleChange}
              autoFocus={!isRegister}
            />
          </div>

          <div className="form-group">
            <label htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              name="password"
              type="password"
              placeholder={isRegister ? "At least 6 characters" : "Enter your password"}
              value={formData.password}
              onChange={handleChange}
            />
          </div>

          <div className="auth-actions">
            <button
              type="submit"
              className="primary-button submit-btn"
              disabled={loading}
            >
              {loading
                ? "Processing..."
                : isRegister
                ? "Create Account"
                : "Sign In"}
            </button>

            {!isRegister && (
              <button
                type="button"
                className="demo-button"
                onClick={handleDemoFill}
              >
                Use Demo Farm Account (farmer@poultry.local)
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

export default AuthModal;
