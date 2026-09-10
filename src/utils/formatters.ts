/**
 * Exact provider balance formatter for SociaraX
 * Preserves upstream provider decimal precision (e.g. 0.5010659 or 0.5011)
 * without arbitrary rounding or truncating to 2 decimals.
 */
export function formatExactProviderBalance(val: number | string | undefined | null): string {
  if (val === undefined || val === null || val === '') return '0.00';
  const str = String(val).trim();
  const num = parseFloat(str);
  if (isNaN(num)) return '0.00';

  if (str.includes('.')) {
    // Remove excess trailing zeroes beyond 2 decimal places, but preserve at least 2 decimal places
    let trimmed = str.replace(/0+$/, '');
    const parts = trimmed.split('.');
    if (parts.length > 1 && parts[1].length < 2) {
      trimmed = parts[0] + '.' + parts[1].padEnd(2, '0');
    }
    return trimmed;
  }
  return num.toFixed(2);
}
