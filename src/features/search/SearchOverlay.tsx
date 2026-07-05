import { useEffect, useMemo, useRef, useState } from 'react';
import { buildSearch, searchStations } from '../../lib/search.ts';
import { defaultSort, filterByFuels, sortByDistance, type FuelKey } from '../../lib/filter.ts';
import { haversineKm, type LatLng } from '../../lib/geo.ts';
import {
  getDriveMinutes,
  DRIVE_PREFILTER_KM,
  DRIVE_QUERY_LIMIT,
} from '../../lib/drivetime.ts';
import { FUEL_LABELS, type Station } from '../../types/station.ts';

const MAX_RESULTS = 30; // 覆層列表一次最多呈現數（捲動內）

interface Props {
  stations: Station[];
  userLocation: LatLng | null;
  /** 點選結果：關閉覆層、地圖飛往該站並開資訊卡 */
  onPick: (s: Station) => void;
}

/** 地圖搜尋覆層（Google Maps 慣例）：左上 icon 展開為搜尋框 + 油品篩選 + 結果列表 */
export default function SearchOverlay({ stations, userLocation, onPick }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [fuels, setFuels] = useState<Set<FuelKey>>(new Set());
  const [driveMin, setDriveMin] = useState<Record<string, number>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  const fuse = useMemo(() => buildSearch(stations), [stations]);

  // 車程只在「打開搜尋」時查一次：10km 內最近 10 站（省 API；有 sessionStorage 快取）
  useEffect(() => {
    if (!open || !userLocation || stations.length === 0) return;
    const nearby = sortByDistance(stations, userLocation, haversineKm)
      .filter((s) => haversineKm(userLocation, s) <= DRIVE_PREFILTER_KM)
      .slice(0, DRIVE_QUERY_LIMIT);
    if (nearby.length > 0) getDriveMinutes(userLocation, nearby).then(setDriveMin);
  }, [open, userLocation, stations]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const results = useMemo(() => {
    if (!open) return [];
    let base: Station[];
    if (query.trim()) {
      base = searchStations(fuse, query);
    } else if (userLocation) {
      base = sortByDistance(stations, userLocation, haversineKm).sort((a, b) => {
        const da = driveMin[a.id];
        const db = driveMin[b.id];
        if (da !== undefined && db !== undefined) return da - db;
        if (da !== undefined) return -1;
        if (db !== undefined) return 1;
        return 0;
      });
    } else {
      base = defaultSort(stations);
    }
    return filterByFuels(base, fuels).slice(0, MAX_RESULTS);
  }, [open, fuse, stations, query, fuels, userLocation, driveMin]);

  const toggleFuel = (f: FuelKey) => {
    setFuels((prev) => {
      const next = new Set(prev);
      if (next.has(f)) next.delete(f);
      else next.add(f);
      return next;
    });
  };

  const pick = (s: Station) => {
    setOpen(false);
    onPick(s);
  };

  if (!open) {
    return (
      <button className="search-fab" onClick={() => setOpen(true)} aria-label="搜尋加油站">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.8-3.8" />
        </svg>
      </button>
    );
  }

  return (
    <div className="search-overlay">
      <div className="search-sheet">
        <div className="search-bar">
          <button className="search-back" onClick={() => setOpen(false)} aria-label="關閉搜尋">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜尋站名或區域（如：文山區）"
            aria-label="搜尋加油站"
          />
          {query && (
            <button className="search-clear" onClick={() => setQuery('')} aria-label="清除">
              ×
            </button>
          )}
        </div>
        <div className="fuel-filters">
          {(Object.keys(FUEL_LABELS) as FuelKey[]).map((f) => (
            <button
              key={f}
              className={`filter-btn ${fuels.has(f) ? 'filter-on' : ''}`}
              onClick={() => toggleFuel(f)}
              aria-pressed={fuels.has(f)}
            >
              {FUEL_LABELS[f]}
            </button>
          ))}
        </div>
        <ul className="station-list search-results">
          {results.map((s) => (
            <li key={s.id} className={s.isDirect ? 'row-direct' : 'row-franchise'}>
              <button className="row-main" onClick={() => pick(s)}>
                <div className="row-title">
                  <span className="row-name">{s.name}</span>
                  {s.isDirect ? (
                    <span className="badge badge-direct">直營</span>
                  ) : (
                    <span className="badge badge-franchise">加盟</span>
                  )}
                  {userLocation && (
                    <span className="row-dist">
                      {driveMin[s.id] !== undefined
                        ? `約 ${driveMin[s.id]} 分鐘`
                        : `${haversineKm(userLocation, s).toFixed(1)} km`}
                    </span>
                  )}
                </div>
                <div className="row-sub">
                  {s.county}
                  {s.town}
                  <span className="row-fuels">
                    {(Object.keys(FUEL_LABELS) as FuelKey[])
                      .filter((f) => s.fuels[f])
                      .map((f) => FUEL_LABELS[f].replace(' 無鉛', ''))
                      .join('・')}
                  </span>
                </div>
              </button>
            </li>
          ))}
          {results.length === 0 && <li className="search-empty">找不到符合的加油站</li>}
        </ul>
      </div>
    </div>
  );
}
