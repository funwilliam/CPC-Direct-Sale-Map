import Fuse from 'fuse.js';
import type { Station } from '../types/station.ts';

/** fuse 索引（spec/list-search.md §搜尋） */
export function buildSearch(stations: Station[]): Fuse<Station> {
  return new Fuse(stations, {
    keys: [
      { name: 'name', weight: 2 },
      { name: 'town', weight: 1.5 },
      { name: 'county', weight: 1 },
      { name: 'address', weight: 1 },
    ],
    threshold: 0.35,
    ignoreLocation: true,
  });
}

export function searchStations(fuse: Fuse<Station>, query: string): Station[] {
  return fuse.search(query.trim()).map((r) => r.item);
}
