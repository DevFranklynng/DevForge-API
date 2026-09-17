export const jsonParse = (value, fallback = undefined) => {
  if (value === null || value === undefined || value === "") return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

export const jsonStringify = (value) => JSON.stringify(value);

export const clamp = (n, min, max) =>
  Math.min(max, Math.max(min, n));

export const DAY_MS = 24 * 60 * 60 * 1000;

export const daysFromNow = (days) => new Date(Date.now() + days * DAY_MS);

export function titleCase(value) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
