/**
 * Feed-unit conversion service (extracted from finance.controller.js and
 * dailyRecord.controller.js). Single place for kg <-> bags conversions.
 */

const isKg = (u) => ["kg", "kgs", "kilogram", "kilograms"].includes((u || "").trim().toLowerCase());
const isBag = (u) => ["bag", "bags"].includes((u || "").trim().toLowerCase());

const convertToFeedUnit = (purchaseQty, purchaseUnit, feedType) => {
  const pUnit = (purchaseUnit || "").trim().toLowerCase();
  const fUnit = (feedType.unit || "").trim().toLowerCase();
  const bagWeight = Number(feedType.bagWeightKg);

  if (!isKg(pUnit) && !isBag(pUnit)) {
    const error = new Error(
      `Unsupported feed unit conversion from '${purchaseUnit || "unspecified"}'. Supported units for automatic conversion are 'kg' and 'bags'.`
    );
    error.code = "UNSUPPORTED_UNIT";
    throw error;
  }
  if (!isKg(fUnit) && !isBag(fUnit)) {
    const error = new Error(
      `Unsupported feed storage unit '${feedType.unit}'. Supported storage units are 'kg' and 'bags'.`
    );
    error.code = "UNSUPPORTED_UNIT";
    throw error;
  }
  if ((isKg(pUnit) && isKg(fUnit)) || (isBag(pUnit) && isBag(fUnit))) return purchaseQty;
  if (!bagWeight || bagWeight <= 0) {
    const error = new Error(
      `Feed type '${feedType.name}' does not have a valid bag weight configured for conversion.`
    );
    error.code = "INVALID_BAG_WEIGHT";
    throw error;
  }
  if (isBag(pUnit) && isKg(fUnit)) return purchaseQty * bagWeight;
  if (isKg(pUnit) && isBag(fUnit)) return purchaseQty / bagWeight;

  const error = new Error(
    `Unsupported feed unit conversion from '${purchaseUnit || "unspecified"}' to '${feedType.unit}'. Supported units for automatic conversion are 'kg' and 'bags'.`
  );
  error.code = "UNSUPPORTED_UNIT";
  throw error;
};

const calculateConsumptionInFeedUnit = (feedUsedKg, feedType) => {
  const fUnit = (feedType.unit || "").trim().toLowerCase();
  const bagWeight = Number(feedType.bagWeightKg);
  if (isKg(fUnit)) return feedUsedKg;
  if (isBag(fUnit)) {
    if (!bagWeight || bagWeight <= 0) {
      const error = new Error(
        `Feed type '${feedType.name}' does not have a valid bag weight configured for conversion.`
      );
      error.code = "INVALID_BAG_WEIGHT";
      throw error;
    }
    return feedUsedKg / bagWeight;
  }
  const error = new Error(
    `Unsupported feed unit conversion from daily usage in kg to feed inventory unit '${feedType.unit}'. Supported units for daily feeding are kg and bags.`
  );
  error.code = "UNSUPPORTED_UNIT";
  throw error;
};

module.exports = { convertToFeedUnit, calculateConsumptionInFeedUnit };
