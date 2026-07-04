import { useCallback, useEffect, useState } from 'react';
import MapPage from './features/map/MapPage.tsx';
import ListPage from './features/list/ListPage.tsx';
import PricePage from './features/price/PricePage.tsx';
import type { LatLng } from './lib/geo.ts';
import type { CurrentPriceFile, PriceHistoryFile, Station, StationsFile } from './types/station.ts';

type Tab = 'map' | 'list' | 'price';

const TAB_ICONS: Record<Tab, string> = {
  // 24x24 stroke path（設計規範見 docs/spec/design.md §圖標）
  map: 'M12 21s-7-5.1-7-11a7 7 0 1 1 14 0c0 5.9-7 11-7 11Zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  list: 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01',
  price: 'M12 1v22M17 5.5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
};

export default function App() {
  const [tab, setTab] = useState<Tab>('map');
  const [stations, setStations] = useState<Station[]>([]);
  const [price, setPrice] = useState<CurrentPriceFile | null>(null);
  const [history, setHistory] = useState<PriceHistoryFile | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Station | null>(null);
  const [autoFitDone, setAutoFitDone] = useState(false);
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);

  useEffect(() => {
    const base = import.meta.env.BASE_URL;
    Promise.all([
      fetch(`${base}data/stations.json`).then((r) => r.json() as Promise<StationsFile>),
      fetch(`${base}data/current_price.json`).then((r) => r.json() as Promise<CurrentPriceFile>),
      fetch(`${base}data/price_history.json`).then((r) => r.json() as Promise<PriceHistoryFile>),
    ])
      .then(([s, p, h]) => {
        setStations(s.stations);
        setPrice(p);
        setHistory(h);
      })
      .catch((e) => setDataError(String(e)));
  }, []);

  // 清單頁的距離/車程共用一次定位（地圖頁的定位由 MapPage 自行處理）
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { timeout: 10_000 }
    );
  }, []);

  const showOnMap = useCallback((s: Station) => {
    setSelected(s);
    setTab('map');
  }, []);

  const onAutoFitDone = useCallback(() => setAutoFitDone(true), []);

  return (
    <div className="app">
      <header className="app-header">
        <span className="logo-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 21s-7-5.1-7-11a7 7 0 1 1 14 0c0 5.9-7 11-7 11Z" />
            <circle cx="12" cy="10" r="2.5" />
          </svg>
        </span>
        <h1>順路油站</h1>
      </header>
      {dataError && <p className="error page-pad">站點資料載入失敗：{dataError}</p>}
      <main className="app-main">
        {/* 地圖分頁用 display 切換保留實例，避免重複載入 Maps JS */}
        <div style={{ display: tab === 'map' ? 'contents' : 'none' }}>
          <MapPage
            stations={stations}
            autoFitDone={autoFitDone}
            onAutoFitDone={onAutoFitDone}
            selected={tab === 'map' ? selected : null}
            onSelect={setSelected}
          />
        </div>
        {tab === 'list' && (
          <ListPage stations={stations} userLocation={userLocation} onShowOnMap={showOnMap} />
        )}
        {tab === 'price' && <PricePage price={price} history={history} />}
      </main>
      <nav className="tab-bar" aria-label="主要導覽">
        {(
          [
            ['map', '地圖'],
            ['list', '清單'],
            ['price', '油價'],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            className={tab === key ? 'tab-on' : ''}
            onClick={() => setTab(key)}
            aria-current={tab === key ? 'page' : undefined}
          >
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d={TAB_ICONS[key]} />
            </svg>
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
