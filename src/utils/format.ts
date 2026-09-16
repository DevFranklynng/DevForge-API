export type Watermark = boolean;

export const jsonParse = (
  value: string | null | undefined,
  fallback: unknown = undefined,
): unknown => {
  if (value === null || value === undefined || value === "") return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

export const jsonStringify = (value: unknown): string => JSON.stringify(value);

export const clamp = (n: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, n));

export const DAY_MS = 24 * 60 * 60 * 1000;

export const daysFromNow = (days: number): Date => new Date(Date.now() + days * DAY_MS);

export function titleCase(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}