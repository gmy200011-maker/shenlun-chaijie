/**
 * Convert any value into a readable string for safe rendering.
 * React throws "Objects are not valid as a React child" (#31) when an
 * object (e.g. an axios error `{code, message}` or a raw API body) is
 * rendered directly. Centralising the coercion here guarantees callers
 * can never accidentally inject an object into JSX.
 */
export function safeText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value instanceof Error) {
    return value.message || safeText((value as any).response?.data) || "未知错误";
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
