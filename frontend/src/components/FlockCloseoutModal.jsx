import { useState, useEffect } from "react";
import { closeoutFlock } from "../services/api";
import { formatCurrency, DEFAULT_CURRENCY } from "../services/currency";

const CLOSE_STATUSES = [
  { value: "COMPLETED", label: "Completed (Production finished)" },
  { value: "SOLD", label: "Sold (Marketed)" },
  { value: "SLAUGHTERED", label: "Slaughtered / Harvested" },
  { value: "ARCHIVED", label: "Archived" },
];

function FlockCloseoutModal({ isOpen, onClose, onConfirmed, flock, mode = "close" }) {
  const isReopen = mode === "reopen";
  const [status, setStatus] = useState("COMPLETED");
  const [acknowledged, setAcknowledged] = useState(false);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setStatus("COMPLETED");
      setAcknowledged(false);
      setNotes("");
      setError("");
      setResult(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen || !flock) return null;

  const perf = flock.performance || {};
  const fin = flock.financials || {};
  const currency = fin.currency || DEFAULT_CURRENCY;
  const liveBirds = Number(flock.currentBirds ?? 0);
  const needsAck = !isReopen && liveBirds > 0;
  const canConfirm = isReopen || !needsAck || acknowledged;

  const handleConfirm = async () => {
    setError("");
    if (!canConfirm) {
      setError(`This flock still has ${liveBirds} live birds. Tick the acknowledgment box to proceed.`);
      return;
    }
    try {
      setSaving(true);
      const res = await closeoutFlock(flock.id, {
        status: isReopen ? "ACTIVE" : status,
        acknowledgeRemainingBirds: acknowledged,
        notes: notes.trim() || null,
      });
      setResult(res.data);
    } catch (err) {
      setError(err.message || "Failed to update flock lifecycle.");
    } finally {
      setSaving(false);
    }
  };

  const summary = result || null;
  const fin2 = summary?.financials || fin;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600 }}>
        <div className="modal-header">
          <div>
            <h3>{isReopen ? `Reopen Flock "${flock.name}"` : `Close Out Flock "${flock.name}"`}</h3>
            <p className="modal-subtitle">
              {isReopen
                ? "The flock returns to ACTIVE and accepts new operational records again."
                : "Final reconciled summary. The server calculates every number below."}
            </p>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close modal">
            &times;
          </button>
        </div>

        {error && (
          <div className="alert-banner alert-error" style={{ margin: "0 24px 16px" }}>
            {error}
          </div>
        )}

        <div style={{ padding: "0 24px 24px" }}>
          {!summary && (
            <>
              <div style={{ display: "grid", gap: 14, fontSize: 13, marginBottom: 16 }}>
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>🐔 Bird reconciliation</div>
                  <div>Placed: <strong>{Number(flock.birdsPlaced ?? 0).toLocaleString()}</strong> · Mortality: <strong>{Number(perf.totalMortality ?? 0).toLocaleString()}</strong> · Depopulated: <strong>{Number(perf.totalDepopulated ?? 0).toLocaleString()}</strong> · Remaining: <strong>{liveBirds.toLocaleString()}</strong></div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Mortality rate: {perf.mortalityRate ?? 0}%</div>
                </div>
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>📦 Production</div>
                  <div>Eggs: <strong>{Number(perf.totalEggs ?? 0).toLocaleString()}</strong> · Feed: <strong>{Number(perf.totalFeedKg ?? 0).toLocaleString()} kg</strong>{perf.latestWeightGrams ? <> · Latest weight: <strong>{perf.latestWeightGrams} g</strong></> : null}</div>
                </div>
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>💰 Recorded financials</div>
                  <div>Revenue: <strong>{formatCurrency(fin2.totalRevenue ?? 0, currency)}</strong> · Expenses: <strong>{formatCurrency(fin2.totalExpenses ?? 0, currency)}</strong> · Net: <strong>{formatCurrency(fin2.netProfitLoss ?? 0, currency)}</strong></div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    Feed {formatCurrency(fin2.feedCost ?? 0, currency)} · Vaccines {formatCurrency(fin2.vaccineCost ?? 0, currency)}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                    Based only on income and expenses currently linked to this flock. Farm or house-level costs are not allocated automatically.
                  </div>
                </div>
              </div>

              {!isReopen && (
                <div className="form-group">
                  <label htmlFor="closeout-status">Final Status</label>
                  <select id="closeout-status" value={status} onChange={(e) => setStatus(e.target.value)}>
                    {CLOSE_STATUSES.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {!isReopen && (
                <div className="form-group">
                  <label htmlFor="closeout-notes">Closeout Note (Optional)</label>
                  <input
                    id="closeout-notes"
                    type="text"
                    placeholder="e.g. Batch finished, all birds marketed."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              )}

              {needsAck && (
                <label style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "10px 12px", borderRadius: 6, background: "#fffbeb", border: "1px solid #fde68a", fontSize: 13, marginBottom: 12 }}>
                  <input
                    type="checkbox"
                    checked={acknowledged}
                    onChange={(e) => setAcknowledged(e.target.checked)}
                    style={{ marginTop: 3 }}
                  />
                  <span>I understand that this flock still has <strong>{liveBirds.toLocaleString()} live birds</strong>.</span>
                </label>
              )}
            </>
          )}

          {summary && (
            <div style={{ fontSize: 13, display: "grid", gap: 12 }}>
              <div style={{ padding: "10px 14px", borderRadius: 6, background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                ✓ {summary.transition === "REOPEN" ? "Flock reopened." : "Flock closed."} Status: <strong>{summary.status}</strong>
              </div>
              <div>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>🐔 Birds</div>
                <div>Placed {summary.birds.birdsPlaced} · Mortality {summary.birds.correctedMortality} · Depopulated {summary.birds.totalDepopulated} · Remaining {summary.birds.liveBirds} · Loss {summary.birds.mortalityRate}%</div>
              </div>
              <div>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>📦 Production</div>
                <div>Eggs {summary.production.totalEggs} · Feed {summary.production.totalFeedKg} kg · {summary.production.productionDays} production days</div>
              </div>
              <div>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>🥚 Egg flow (farm ledger, this flock)</div>
                <div>Produced {summary.eggFlow.produced} · Sold {summary.eggFlow.sold} · Wasted {summary.eggFlow.wasted} · Adjusted {summary.eggFlow.adjusted} · Returned {summary.eggFlow.returned}</div>
              </div>
              <div>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>💰 Recorded net result</div>
                <div>Revenue {formatCurrency(summary.financials.totalRevenue, currency)} · Expenses {formatCurrency(summary.financials.totalExpenses, currency)} · Feed {formatCurrency(summary.financials.feedCost, currency)} · Vaccines {formatCurrency(summary.financials.vaccineCost, currency)} · <strong>Net {formatCurrency(summary.financials.netProfitLoss, currency)}</strong></div>
              </div>
            </div>
          )}

          <div className="form-actions modal-actions" style={{ marginTop: 16 }}>
            {summary ? (
              <button type="button" className="primary-button btn btn-primary" onClick={() => { onConfirmed(); onClose(); }}>
                Done
              </button>
            ) : (
              <>
                <button type="button" className="secondary-button btn btn-secondary" onClick={onClose} disabled={saving}>
                  Cancel
                </button>
                <button
                  type="button"
                  className={isReopen ? "primary-button btn btn-primary" : "danger-button"}
                  onClick={handleConfirm}
                  disabled={saving || !canConfirm}
                >
                  {saving ? "Saving..." : isReopen ? "Reopen Flock" : `Close as ${status}`}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default FlockCloseoutModal;
