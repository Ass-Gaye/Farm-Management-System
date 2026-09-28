/**
 * Flock lifecycle / operational-lock helpers (Phase 4.4).
 *
 * A flock with status !== ACTIVE is closed and must not receive NEW
 * operational records (daily records, depopulation events, egg sales,
 * vaccinations, slaughter completions). Reads, corrections of existing
 * history, and reopening to ACTIVE remain allowed.
 */

const ACTIVE_STATUS = "ACTIVE";

// Non-operational statuses: flocks in any of these reject new records.
const CLOSED_STATUSES = ["COMPLETED", "SOLD", "SLAUGHTERED", "ARCHIVED"];

const isActiveStatus = (status) => status === ACTIVE_STATUS;

const flockNotActiveError = (flockName) => {
  const error = new Error(
    `This flock${flockName ? ` ("${flockName}")` : ""} is closed and cannot receive new operational records. Reopen the flock first.`
  );
  error.code = "FLOCK_NOT_ACTIVE";
  throw error;
};

/**
 * Throws FLOCK_NOT_ACTIVE when the given flock row is closed.
 * Accepts a full or partial flock row ({ status, name }).
 */
const assertFlockOperational = (flock) => {
  if (!flock || !isActiveStatus(flock.status)) {
    flockNotActiveError(flock?.name);
  }
};

/**
 * Transition rules for the closeout endpoint.
 * ACTIVE -> closed (close, live-bird acknowledgment may apply).
 * closed -> ACTIVE (reopen, always allowed).
 * closed -> different closed status (e.g. COMPLETED -> ARCHIVED).
 * Same-status requests are idempotent no-ops.
 */
const resolveTransition = (fromStatus, toStatus) => {
  const from = String(fromStatus || "").toUpperCase();
  const to = String(toStatus || "").toUpperCase();

  if (from === to) {
    return { kind: "NO_OP", from, to };
  }
  if (to === ACTIVE_STATUS) {
    return { kind: "REOPEN", from, to };
  }
  if (from === ACTIVE_STATUS && CLOSED_STATUSES.includes(to)) {
    return { kind: "CLOSE", from, to };
  }
  if (CLOSED_STATUSES.includes(from) && CLOSED_STATUSES.includes(to)) {
    return { kind: "RECLOSE", from, to };
  }
  const error = new Error(`Invalid flock status transition from "${from}" to "${to}".`);
  error.code = "INVALID_STATUS_TRANSITION";
  throw error;
};

module.exports = {
  ACTIVE_STATUS,
  CLOSED_STATUSES,
  isActiveStatus,
  flockNotActiveError,
  assertFlockOperational,
  resolveTransition,
};
