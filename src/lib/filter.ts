import type { Fuels, Station } from '../types/station.ts';

export type FuelKey = keyof Fuels;

/** 油品多選 = AND（spec/list-search.md §篩選） */
export function filterByFuels(stations: Station[], fuels: ReadonlySet<FuelKey>): Station[] {
  if (fuels.size === 0) return stations;
  return stations.filter((s) => [...fuels].every((f) => s.fuels[f]));
}

/** 依直線距離排序（車程排序的前置粗篩，見 spec/list-search.md §排序） */
export function sortByDistance<T extends { lat: number; lng: number }>(
  stations: T[],
  user: { lat: number; lng: number },
  distanceFn: (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => number
): T[] {
  return [...stations].sort((a, b) => distanceFn(user, a) - distanceFn(user, b));
}

/** 預設排序：直營在前，同組依縣市、站名 */
export function defaultSort(stations: Station[]): Station[] {
  return [...stations].sort((a, b) => {
    if (a.isDirect !== b.isDirect) return a.isDirect ? -1 : 1;
    return a.county.localeCompare(b.county, 'zh-TW') || a.name.localeCompare(b.name, 'zh-TW');
  });
}
