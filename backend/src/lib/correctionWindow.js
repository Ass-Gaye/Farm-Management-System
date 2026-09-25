/**
 * Centralized correction-window rule for historical records.
 *
 * Recent records (within the window) can be edited/deleted directly and
 * the system reverses/reapplies their effects transactionally.
 * Older records are immutable via normal edit/delete; their effects must
 * be corrected with a reversal/correction entry (e.g. a manual stock
 * ADJUSTMENT referencing the original record) so the audit trail stays
 * intact.
 *
 * The window is measured from the record's creation time (when it was
 * entered), NOT its business date: a farmer correcting today's entry
 * tomorrow is a recent correction; a record entered months ago is history.
 *
 * One rule, one place: all historical-record controllers must use these
 * helpers instead of hard-coding cutoffs.
 */

const getCorrectionWindowDays = () => {
  const raw = process.env.DAILY_RECORD_EDIT_WINDOW_DAYS;
  const parsed = raw !== undefined && raw !== "" ? Number(raw) : NaN;
  if (!Number.isNaN(parsed) && parsed >= 0) {
    return parsed;
  }
  return 7;
};

const isWithinCorrectionWindow = (createdAt, now = new Date()) => {
  if (!createdAt) {
    return true;
  }
  const windowDays = getCorrectionWindowDays();
  const ageMs = new Date(now).getTime() - new Date(createdAt).getTime();
  return ageMs <= windowDays * 24 * 60 * 60 * 1000;
};

const immutableRecordError = (recordLabel = "Daily record") => {
  const error = new Error(
    `${recordLabel} is outside the ${getCorrectionWindowDays()}-day correction window and can no longer be edited or deleted. ` +
      `Use the Correct action to record a mortality/egg correction, or a stock adjustment for feed effects.`
  );
  error.code = "RECORD_IMMUTABLE";
  return error;
};

module.exports = {
  getCorrectionWindowDays,
  isWithinCorrectionWindow,
  immutableRecordError,
};
