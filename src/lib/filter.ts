import type { Fuels, Station } from '../types/station.ts';

export type FuelKey = keyof Fuels;

/** 油品多選 = AND（spec/list-search.md §篩選） */
export function filterByFuels(stations: Station[], fuels: ReadonlySet<FuelKey>): Station[] {
  if (fuels.size === 0) return stations;
  return stations.filter((s) => [...fuels].every((f) => s.fuels[f]));
}

/** 預設排序：直營在前，同組依縣市、站名 */
export function defaultSort(stations: Station[]): Station[] {
  return [...stations].sort((a, b) => {
    if (a.isDirect !== b.isDirect) return a.isDirect ? -1 : 1;
    return a.county.localeCompare(b.county, 'zh-TW') || a.name.localeCompare(b.name, 'zh-TW');
  });
}
