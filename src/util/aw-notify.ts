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

/** A single saved aw-notify alert row (server DTO shape used by this panel). */
export interface AwNotifyAlert {
  label: string | null;
  category: string | null;
  thresholdMinutes: number[];
  positive: boolean;
}

/**
 * Persisted aw-notify settings. `enabled` is optional for backwards
 * compatibility with older saves; unknown keys are preserved verbatim.
 */
export interface AwNotifyConfig {
  enabled?: boolean;
  alerts: AwNotifyAlert[];
  [key: string]: unknown;
}

function isAwNotifyAlert(value: unknown): value is AwNotifyAlert {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  const thresholds = candidate.thresholdMinutes;
  return (
    (typeof candidate.label === 'string' || candidate.label === null) &&
    (typeof candidate.category === 'string' || candidate.category === null) &&
    Array.isArray(thresholds) &&
    thresholds.every(n => typeof n === 'number' && Number.isInteger(n) && n > 0) &&
    typeof candidate.positive === 'boolean'
  );
}

function hasOptionalBoolean(config: Record<string, unknown>, key: string): boolean {
  return config[key] === undefined || typeof config[key] === 'boolean';
}

/**
 * Strictly validate a loaded aw-notify settings payload. Returns the parsed
 * config when `alerts` is a valid array and every optional flag field is a
 * boolean (or absent); null otherwise. Same strictness as parseThresholds:
 * there is no "enabled but invalid" state that can pass through.
 */
export function parseAwNotifyConfig(value: unknown): AwNotifyConfig | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  const config = value as Record<string, unknown>;
  if (!Array.isArray(config.alerts) || !config.alerts.every(isAwNotifyAlert)) {
    return null;
  }
  if (!hasOptionalBoolean(config, 'enabled')) {
    return null;
  }
  return config as unknown as AwNotifyConfig;
}
