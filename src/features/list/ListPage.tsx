import { useMemo, useState } from 'react';
import { buildSearch, searchStations } from '../../lib/search.ts';
import { defaultSort, filterByFuels, type FuelKey } from '../../lib/filter.ts';
import { haversineKm, type LatLng } from '../../lib/geo.ts';
import { FUEL_LABELS, type Station } from '../../types/station.ts';

const MAX_RENDER = 200; // spec/list-search.md §顯示

interface Props {
  stations: Station[];
  userLocation: LatLng | null;
  onShowOnMap: (s: Station) => void;
}

export default function ListPage({ stations, userLocation, onShowOnMap }: Props) {
  const [query, setQuery] = useState('');
  const [fuels, setFuels] = useState<Set<FuelKey>>(new Set());

  const fuse = useMemo(() => buildSearch(stations), [stations]);

  const results = useMemo(() => {
    const base = query.trim() ? searchStations(fuse, query) : defaultSort(stations);
    return filterByFuels(base, fuels);
  }, [fuse, stations, query, fuels]);

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
        共 {results.length} 站{results.length > MAX_RENDER ? `，僅顯示前 ${MAX_RENDER} 筆，請縮小範圍` : ''}
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
                  <span className="row-dist">{haversineKm(userLocation, s).toFixed(1)} km</span>
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
    </div>
  );
}
