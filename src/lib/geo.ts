import type { Station } from '../types/station.ts';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Bounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

// spec/map.md §自動縮放：20 分鐘車程（一般道路均速 ~45km/h）≈ 15km
export const MAX_RADIUS_KM = 15;
export const FAR_FALLBACK_ZOOM = 14; // 超出範圍時的固定美觀縮放（街區層級）
export const ZOOM_CEIL = 16;

export const TAIWAN_BOUNDS: Bounds = { north: 26.5, south: 21.7, east: 122.1, west: 118.1 };

const EARTH_R_KM = 6371;

export function haversineKm(a: LatLng, b: LatLng): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_R_KM * Math.asin(Math.sqrt(s));
}

export function nearestStation(
  user: LatLng,
  stations: Station[]
): { station: Station; km: number } | null {
  let best: { station: Station; km: number } | null = null;
  for (const s of stations) {
    const km = haversineKm(user, s);
    if (!best || km < best.km) best = { station: s, km };
  }
  return best;
}

export type ViewPlan =
  | { kind: 'taiwan'; bounds: Bounds }
  | { kind: 'fit'; bounds: Bounds; maxZoom: number }
  | { kind: 'far'; center: LatLng; zoom: number };

/** 初次定位後的視野規劃（僅每 session 執行一次，見 spec/map.md） */
export function planInitialView(user: LatLng | null, directs: Station[]): ViewPlan {
  if (!user) return { kind: 'taiwan', bounds: TAIWAN_BOUNDS };

  const nearest = nearestStation(user, directs);
  if (!nearest || nearest.km > MAX_RADIUS_KM) {
    return { kind: 'far', center: user, zoom: FAR_FALLBACK_ZOOM };
  }

  const { station } = nearest;
  // user + 最近站的外接框，各方向外擴 20%（至少 0.005 度避免零跨度）
  const latSpan = Math.max(Math.abs(user.lat - station.lat), 0.005);
  const lngSpan = Math.max(Math.abs(user.lng - station.lng), 0.005);
  const pad = 0.2;
  return {
    kind: 'fit',
    bounds: {
      north: Math.max(user.lat, station.lat) + latSpan * pad,
      south: Math.min(user.lat, station.lat) - latSpan * pad,
      east: Math.max(user.lng, station.lng) + lngSpan * pad,
      west: Math.min(user.lng, station.lng) - lngSpan * pad,
    },
    maxZoom: ZOOM_CEIL,
  };
}
