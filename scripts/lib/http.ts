export const UA =
  'Mozilla/5.0 (compatible; CPC-Direct-Sale-Map/0.1; +https://github.com/funwilliam/CPC-Direct-Sale-Map)';

const TIMEOUT_MS = 30_000;
const RETRIES = 2; // 政府/國營網站常有暫時性抖動：逾時或 5xx 退避重試

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fetchText(url: string, init?: RequestInit): Promise<string> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        ...init,
        headers: { 'User-Agent': UA, ...(init?.headers ?? {}) },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (res.status >= 500) throw new Error(`HTTP ${res.status} ${url}`); // 5xx 可重試
      if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status} ${url}`), { noRetry: true });
      return await res.text();
    } catch (e) {
      lastErr = e;
      if ((e as { noRetry?: boolean }).noRetry || attempt === RETRIES) break;
      await sleep(2000 * (attempt + 1)); // 2s、4s 退避
    }
  }
  throw lastErr;
}

export async function fetchJson<T = unknown>(url: string): Promise<T> {
  const text = await fetchText(url);
  return JSON.parse(text) as T;
}
