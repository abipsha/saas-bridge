import { logger } from "../core/logger";

/** Small fetch wrapper with a timeout, JSON parsing, and one retry on 5xx. */
export async function requestJson<T>(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
  attempt = 1
): Promise<T> {
  const { timeoutMs = 15000, ...rest } = init;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...rest, signal: ctrl.signal });
    const text = await res.text();
    if (!res.ok) {
      // Retry once on transient upstream errors.
      if (res.status >= 500 && attempt < 2) {
        logger.warn("Upstream 5xx, retrying", { url, status: res.status });
        await new Promise((r) => setTimeout(r, 500 * attempt));
        return requestJson<T>(url, init, attempt + 1);
      }
      throw new Error(`Request to ${url} failed: ${res.status} ${text.slice(0, 300)}`);
    }
    return (text ? JSON.parse(text) : {}) as T;
  } finally {
    clearTimeout(timer);
  }
}
