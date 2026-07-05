// 資料存取層（ADR-009）：離線優先，平常不連回伺服器。
// 首次使用下載入 Cache API；之後一律讀本機快取；距上次成功同步 >7 天才於開啟時
// 背景嘗試更新，失敗不影響使用。事件寫入更新紀錄（設定頁可查）。
import type { CurrentPriceFile, PriceHistoryFile, StationsFile } from '../types/station.ts';

const CACHE_NAME = 'data-v1';
const SYNC_KEY = 'lastDataSync';
const LOG_KEY = 'syncLog';
const FILES = ['stations.json', 'current_price.json', 'price_history.json'] as const;

/**
 * 最近一次「排程資料部署」時間點：GitHub Actions 每週日 18:30 UTC（台灣週一 02:30）
 * 更新資料，+30 分部署緩衝 → 以每週日 19:00 UTC 為基準。
 * 本機同步時間早於此 → 伺服器有新資料，需重抓；晚於此 → 免連線。
 */
export function lastScheduledUpdate(now = Date.now()): number {
  const d = new Date(now);
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 19, 0, 0));
  t.setUTCDate(t.getUTCDate() - t.getUTCDay()); // 回推到本週日
  if (t.getTime() > now) t.setUTCDate(t.getUTCDate() - 7); // 本週日 19:00 未到 → 上週日
  return t.getTime();
}

export interface SyncLogEntry {
  t: number;
  msg: string;
}

export function getSyncLog(): SyncLogEntry[] {
  try {
    return JSON.parse(localStorage.getItem(LOG_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function logSync(msg: string): void {
  const log = getSyncLog();
  log.unshift({ t: Date.now(), msg });
  try {
    localStorage.setItem(LOG_KEY, JSON.stringify(log.slice(0, 20)));
  } catch {
    /* ignore */
  }
}

export function getLastSync(): number | null {
  const v = Number(localStorage.getItem(SYNC_KEY) ?? 0);
  return v > 0 ? v : null;
}

function urls(): string[] {
  const base = import.meta.env.BASE_URL;
  return FILES.map((f) => `${base}data/${f}`);
}

async function fetchAllFresh(): Promise<Response[]> {
  const fresh = await Promise.all(urls().map((u) => fetch(u, { cache: 'no-cache' })));
  if (fresh.some((r) => !r.ok)) throw new Error('資料下載失敗');
  return fresh;
}

async function putAll(cache: Cache, responses: Response[]): Promise<void> {
  await Promise.all(urls().map((u, i) => cache.put(u, responses[i].clone())));
  localStorage.setItem(SYNC_KEY, String(Date.now()));
}

/** 伺服器有新一輪排程資料時背景更新（不阻塞、失敗無感） */
async function maybeRefresh(cache: Cache): Promise<void> {
  const last = getLastSync() ?? 0;
  if (last >= lastScheduledUpdate()) return; // 已同步過最新排程資料 → 免連線
  try {
    const fresh = await fetchAllFresh();
    await putAll(cache, fresh);
    logSync('每週資料更新成功');
  } catch {
    logSync('資料更新失敗（沿用既有資料，不影響使用）');
  }
}

export interface AppData {
  stations: StationsFile;
  price: CurrentPriceFile;
  history: PriceHistoryFile;
}

export async function loadData(): Promise<AppData> {
  const cache = await caches.open(CACHE_NAME);
  let responses = await Promise.all(urls().map((u) => cache.match(u)));

  if (responses.some((r) => !r)) {
    // 首次（或快取被清）：下載並入庫
    const fresh = await fetchAllFresh();
    await putAll(cache, fresh);
    logSync('資料下載完成');
    responses = fresh;
  } else {
    void maybeRefresh(cache); // 背景檢查週更，不等待
  }

  const [stations, price, history] = (await Promise.all(
    responses.map((r) => (r as Response).json())
  )) as [StationsFile, CurrentPriceFile, PriceHistoryFile];
  return { stations, price, history };
}

/** 手動清除全部快取（資料 + PWA 殼）並重載 */
export async function clearCachesAndReload(): Promise<void> {
  logSync('手動清除快取');
  try {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
    localStorage.removeItem(SYNC_KEY);
    const regs = await navigator.serviceWorker?.getRegistrations?.();
    if (regs) await Promise.all(regs.map((r) => r.update()));
  } finally {
    location.reload();
  }
}
