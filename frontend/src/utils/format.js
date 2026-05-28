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

/**
 * Format an ISO date string (yyyy-mm-dd) as dd-mm-yyyy for display.
 * Returns '' for empty/null values.
 */
export function fmtDate(val) {
  if (!val) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(val);
  if (!m) return val;
  return `${m[3]}-${m[2]}-${m[1]}`;
}
