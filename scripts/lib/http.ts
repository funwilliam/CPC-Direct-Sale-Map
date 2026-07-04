export const UA =
  'Mozilla/5.0 (compatible; CPC-Direct-Sale-Map/0.1; +https://github.com/funwilliam/CPC-Direct-Sale-Map)';

export async function fetchText(url: string, init?: RequestInit): Promise<string> {
  const res = await fetch(url, {
    ...init,
    headers: { 'User-Agent': UA, ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.text();
}

export async function fetchJson<T = unknown>(url: string): Promise<T> {
  const text = await fetchText(url);
  return JSON.parse(text) as T;
}
