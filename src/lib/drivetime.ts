// 車程估算（spec/list-search.md §排序、ADR-006）
// 省 API 原則：先以直線距離粗篩（呼叫端負責），單次最多 25 個目的地，
// 以「使用者位置格網 + 站代號」快取於 sessionStorage，重複瀏覽不再計費。
import { importLibrary } from '@googlemaps/js-api-loader';
import type { LatLng } from './geo.ts';
import type { Station } from '../types/station.ts';

export const DRIVE_TIME_BATCH = 25; // Distance Matrix 單請求上限（API 硬限制）
export const DRIVE_PREFILTER_KM = 10; // 只對 10km 內的站查車程（省 API，v1.2 由 30 縮小）
export const DRIVE_QUERY_LIMIT = 10; // 單次最多查 10 站（省 API，v1.2 由 25 縮小）

/** 使用者位置量化到 ~300m 格網作快取鍵（微小移動不重打 API） */
export function locationCacheKey(user: LatLng): string {
  return `${user.lat.toFixed(3)},${user.lng.toFixed(3)}`;
}

// 車程快取集中於單一鍵，格網數設上限 FIFO 回收（無伺服器 app：可增長資料必設上限）
const STORE_KEY = 'driveTimes';
const MAX_GRIDS = 12;

interface DriveStore {
  order: string[];
  grids: Record<string, Record<string, number>>;
}

function readStore(): DriveStore {
  try {
    const s = JSON.parse(sessionStorage.getItem(STORE_KEY) ?? '') as DriveStore;
    if (Array.isArray(s.order) && s.grids) return s;
  } catch {
    /* ignore */
  }
  return { order: [], grids: {} };
}

function readCache(key: string): Record<string, number> {
  return readStore().grids[key] ?? {};
}

function writeCache(key: string, data: Record<string, number>): void {
  const s = readStore();
  if (!s.grids[key]) {
    s.order.push(key);
    while (s.order.length > MAX_GRIDS) {
      const oldest = s.order.shift();
      if (oldest) delete s.grids[oldest];
    }
  }
  s.grids[key] = data;
  try {
    sessionStorage.setItem(STORE_KEY, JSON.stringify(s));
  } catch {
    /* ignore（隱私模式等） */
  }
}

/**
 * 取得使用者到各站的行車分鐘數。呼叫端應先粗篩（≤25 站）。
 * 失敗（API 未啟用/超額）回傳空物件，呼叫端 fallback 直線距離排序。
 */
export async function getDriveMinutes(
  user: LatLng,
  stations: Station[]
): Promise<Record<string, number>> {
  const key = locationCacheKey(user);
  const cached = readCache(key);
  const missing = stations.filter((s) => cached[s.id] === undefined).slice(0, DRIVE_TIME_BATCH);
  if (missing.length === 0) return cached;

  try {
    const { DistanceMatrixService, TravelMode } = (await importLibrary(
      'routes'
    )) as google.maps.RoutesLibrary;
    const svc = new DistanceMatrixService();
    const res = await svc.getDistanceMatrix({
      origins: [user],
      destinations: missing.map((s) => ({ lat: s.lat, lng: s.lng })),
      travelMode: TravelMode.DRIVING,
    });
    res.rows[0]?.elements.forEach((el, i) => {
      if (el.status === 'OK' && el.duration) {
        cached[missing[i].id] = Math.round(el.duration.value / 60);
      }
    });
    writeCache(key, cached);
  } catch (e) {
    console.warn('Distance Matrix 不可用，退回直線距離排序', e);
  }
  return cached;
}
