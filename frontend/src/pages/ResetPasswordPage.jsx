import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { resetPassword } from "../services/api";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const queryToken = searchParams.get("token") || "";

  const [token, setToken] = useState(queryToken);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  // Keep the token in sync if the ?token= query value changes.
  useEffect(() => {
    setToken(queryToken);
  }, [queryToken]);

  const prefilledToken = queryToken;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!token.trim()) {
      setError("Reset token is missing. Please use the full link from your email.");
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setError("New password must be at least 6 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    try {
      setLoading(true);
      const result = await resetPassword({ token: token.trim(), newPassword });
      setSuccess(result.message || "Password has been reset successfully. You can now sign in.");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err.message || "Password reset failed. Your link may have expired — request a new one.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-overlay">
      <div className="auth-modal">
        <div className="auth-header">
          <div className="auth-logo">🐔</div>
          <h2>Reset your password</h2>
          <p>Choose a new password for your farm account</p>
        </div>

        {success ? (
          <div>
            <p className="form-success">{success}</p>
            <Link to="/dashboard" className="primary-button" style={{ display: "block", textAlign: "center", marginTop: 16 }}>
              Go to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {!prefilledToken && (
              <div className="form-group">
                <label>Reset token</label>
                <input
                  type="text"
                  placeholder="Paste the token from your email"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  autoComplete="off"
                />
              </div>
            )}
            <div className="form-group">
              <label>New password</label>
              <input
                type="password"
                placeholder="At least 6 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className="form-group">
              <label>Confirm new password</label>
              <input
                type="password"
                placeholder="Repeat the new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>

            {error && <p className="error-message">{error}</p>}

            <button type="submit" className="primary-button" disabled={loading} style={{ width: "100%" }}>
              {loading ? "Resetting..." : "Set new password"}
            </button>
          </form>
        )}

        {!success && (
          <p style={{ marginTop: 16, textAlign: "center" }}>
            <Link to="/dashboard">Back to sign in</Link>
          </p>
        )}
      </div>
    </div>
  );
}
