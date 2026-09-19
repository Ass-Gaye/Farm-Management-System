/**
 * Configurable currency utilities for the Poultry Management System.
 * Default currency is GMD (Gambian Dalasi).
 */
export const DEFAULT_CURRENCY = "GMD";

/**
 * Formats a monetary amount into a clean, localized currency string.
 * Example: formatCurrency(5000) => "GMD 5,000.00" or "GMD 5,000"
 *
 * @param {number|string|null|undefined} amount Number or numeric string
 * @param {string} [currency=DEFAULT_CURRENCY] Currency code
 * @param {boolean} [showDecimals=false] Whether to force 2 decimals if amount is an integer
 * @returns {string} Formatted currency string
 */
export function formatCurrency(amount, currency = DEFAULT_CURRENCY, showDecimals = false) {
  const numeric = Number(amount) || 0;

  const hasFractions = numeric % 1 !== 0;
  const decimals = showDecimals || hasFractions ? 2 : 0;

  const formattedNumber = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: 2,
  }).format(numeric);

  return `${currency} ${formattedNumber}`;
}

export default formatCurrency;
