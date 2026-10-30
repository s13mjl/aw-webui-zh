let uidCounter = 0;

export function uid(prefix = 'bv'): string {
  return `${prefix}-${++uidCounter}`;
}

export function looseEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    return String(a) === String(b) && typeof a === typeof b;
  }
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

export function looseIndexOf(arr: any[], val: any): number {
  for (let i = 0; i < arr.length; i++) {
    if (looseEqual(arr[i], val)) return i;
  }
  return -1;
}

export function numberOrString(value: any): any {
  const n = Number(value);
  return isNaN(n) ? value : n;
}

export function isNumeric(value: any): boolean {
  return value !== '' && !isNaN(Number(value));
}

export function coerceModel(value: any, modifiers?: Record<string, boolean>): any {
  if (modifiers?.number) return numberOrString(value);
  if (modifiers?.trim && typeof value === 'string') return value.trim();
  return value;
}

export const colProps = [
  'cols',
  'sm',
  'md',
  'lg',
  'xl',
  'offset',
  'offsetSm',
  'offsetMd',
  'offsetLg',
  'offsetXl',
  'order',
  'orderSm',
  'orderMd',
  'orderLg',
  'orderXl',
] as const;
