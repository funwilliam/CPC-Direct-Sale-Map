import { useEffect, useMemo, useState } from 'react';
import { buildSearch, searchStations } from '../../lib/search.ts';
import { defaultSort, filterByFuels, sortByDistance, type FuelKey } from '../../lib/filter.ts';
import { haversineKm, type LatLng } from '../../lib/geo.ts';
import { getDriveMinutes, DRIVE_TIME_BATCH } from '../../lib/drivetime.ts';
import { FUEL_LABELS, type Station } from '../../types/station.ts';

const MAX_RENDER = 200; // spec/list-search.md §顯示
const DRIVE_PREFILTER_KM = 30; // 只對 30km 內的站查車程（省 API）

interface Props {
  stations: Station[];
  userLocation: LatLng | null;
  onShowOnMap: (s: Station) => void;
}

export default function ListPage({ stations, userLocation, onShowOnMap }: Props) {
  const [query, setQuery] = useState('');
  const [fuels, setFuels] = useState<Set<FuelKey>>(new Set());
  const [driveMin, setDriveMin] = useState<Record<string, number>>({});

  const fuse = useMemo(() => buildSearch(stations), [stations]);

  // 車程：直線距離粗篩 → 最近 25 站一次 Distance Matrix（有快取），失敗自動退回距離排序
  useEffect(() => {
    if (!userLocation || stations.length === 0) return;
    const nearby = sortByDistance(stations, userLocation, haversineKm)
      .filter((s) => haversineKm(userLocation, s) <= DRIVE_PREFILTER_KM)
      .slice(0, DRIVE_TIME_BATCH);
    getDriveMinutes(userLocation, nearby).then(setDriveMin);
  }, [userLocation, stations]);

  const results = useMemo(() => {
    // 搜尋中 → fuse 相關性排序；未搜尋且有定位 → 車程（無車程者以直線距離殿後）；否則預設排序
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
        return 0; // 皆無車程 → 保留距離排序（sort 穩定）
      });
    } else {
      base = defaultSort(stations);
    }
    return filterByFuels(base, fuels);
  }, [fuse, stations, query, fuels, userLocation, driveMin]);

  const toggleFuel = (f: FuelKey) => {
    setFuels((prev) => {
      const next = new Set(prev);
      if (next.has(f)) next.delete(f);
      else next.add(f);
      return next;
    });
  };

  return (
    <div className="list-page">
      <div className="list-controls">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜尋站名或區域（如：文山區）"
          aria-label="搜尋加油站"
        />
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
      </div>
      <p className="result-count">
        共 {results.length} 站
        {results.length > MAX_RENDER ? `，僅顯示前 ${MAX_RENDER} 筆，請縮小範圍` : ''}
        {!query && userLocation ? '・依車程排序' : ''}
      </p>
      <ul className="station-list">
        {results.slice(0, MAX_RENDER).map((s) => (
          <li key={s.id} className={s.isDirect ? 'row-direct' : 'row-franchise'}>
            <button className="row-main" onClick={() => onShowOnMap(s)}>
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
      </ul>
      <p className="attribution">資料來源：台灣中油／政府資料開放平臺（非官方應用）</p>
    </div>
  );
}
