// Correction window mirrors the backend default (server authoritative).
export const CORRECTION_WINDOW_DAYS = 7;

export const isOutsideWindow = (record) => {
  if (!record?.createdAt) return false;
  const ageMs = Date.now() - new Date(record.createdAt).getTime();
  return ageMs > CORRECTION_WINDOW_DAYS * 24 * 60 * 60 * 1000;
};
