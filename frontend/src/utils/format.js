/**
 * Format a numeric amount with thousand-group commas (Indian locale).
 * e.g. 1234567.89 → "12,34,567.89"
 */
export function fmtAmt(val, decimals = 2) {
  const n = Number(val ?? 0);
  if (isNaN(n)) return '0.00';
  return n.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
