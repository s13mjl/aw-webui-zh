/**
 * Parse a comma-separated list of positive whole minutes for the aw-notify
 * mobile notification thresholds. Returns null when any part is invalid
 * (empty, zero, negative, decimal, or non-numeric).
 */
export function parseThresholds(input: string): number[] | null {
  const values = input.split(',').map(s => s.trim());
  if (values.some(part => !/^[1-9]\d*$/.test(part))) {
    return null;
  }
  return values.map(Number);
}
