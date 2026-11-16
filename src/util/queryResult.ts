import moment from 'moment';

/** 判断单个值是否为查询返回的事件对象。 */
export function isEventLike(value: unknown): boolean {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const event = value as Record<string, unknown>;
  const validTimestamp =
    (typeof event.timestamp === 'string' &&
      moment(event.timestamp, moment.ISO_8601, true).isValid()) ||
    (event.timestamp instanceof Date && Number.isFinite(event.timestamp.getTime()));
  return (
    validTimestamp &&
    typeof event.duration === 'number' &&
    Number.isFinite(event.duration) &&
    event.data !== null &&
    typeof event.data === 'object' &&
    !Array.isArray(event.data)
  );
}

/** 判断值是否为可交给事件可视化的事件数组（空数组视为可用）。 */
export function isEventArray(value: unknown): boolean {
  return Array.isArray(value) && value.every(isEventLike);
}

/** 把非事件结果格式化为可读文本。 */
export function formatQueryResult(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
