/**
 * Calculate the average of available signals, ignoring null values
 */
export function calculateAverageSignal(signals: Record<string, number | null>): number {
  const values = Object.values(signals).filter((v): v is number => v !== null);
  if (values.length === 0) return 0;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

/**
 * Check if any signals are available (non-null)
 */
export function hasAnySignals(signals: Record<string, number | null>): boolean {
  return Object.values(signals).some(v => v !== null);
}
