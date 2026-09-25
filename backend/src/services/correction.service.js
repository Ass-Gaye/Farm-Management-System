/**
 * Historical correction helpers for DailyRecords.
 *
 * A DailyRecord outside the correction window is immutable: the row is
 * never edited. Corrections are append-only DailyRecordCorrection rows
 * (field MORTALITY or EGGS) storing previous/corrected values plus the
 * signed adjustment. Reporting sums raw values + adjustments, so the
 * corrected result flows into dashboards, flock views, and bird
 * availability checks without rewriting history.
 */

const CORRECTION_FIELDS = ["MORTALITY", "EGGS"];

// Sums adjustments per record: Map<recordId, { mortality, eggs }>.
const getAdjustmentMaps = async (client, recordIds, userId) => {
  const ids = [...new Set((recordIds || []).map(Number).filter(Boolean))];
  const map = new Map();
  if (ids.length === 0) {
    return map;
  }
  const rows = await client.dailyRecordCorrection.groupBy({
    by: ["dailyRecordId", "field"],
    where: { dailyRecordId: { in: ids }, ...(userId ? { userId } : {}) },
    _sum: { adjustment: true },
  });
  for (const row of rows) {
    const entry = map.get(row.dailyRecordId) || { mortality: 0, eggs: 0 };
    const value = Number(row._sum.adjustment || 0);
    if (row.field === "MORTALITY") {
      entry.mortality += value;
    } else if (row.field === "EGGS") {
      entry.eggs += value;
    }
    map.set(row.dailyRecordId, entry);
  }
  return map;
};

const correctedMortalityOf = (record, map) =>
  record.mortality + ((map && map.get(record.id)?.mortality) || 0);

const correctedEggsOf = (record, map) =>
  record.eggsCollected + ((map && map.get(record.id)?.eggs) || 0);

const sumCorrectedMortality = (records, map) =>
  (records || []).reduce((sum, r) => sum + correctedMortalityOf(r, map), 0);

const sumCorrectedEggs = (records, map) =>
  (records || []).reduce((sum, r) => sum + correctedEggsOf(r, map), 0);

module.exports = {
  CORRECTION_FIELDS,
  getAdjustmentMaps,
  correctedMortalityOf,
  correctedEggsOf,
  sumCorrectedMortality,
  sumCorrectedEggs,
};
