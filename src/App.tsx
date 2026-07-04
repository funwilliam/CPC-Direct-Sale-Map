import { useCallback, useEffect, useState } from 'react';
import MapPage from './features/map/MapPage.tsx';
import ListPage from './features/list/ListPage.tsx';
import PricePage from './features/price/PricePage.tsx';
import type { LatLng } from './lib/geo.ts';
import type { CurrentPriceFile, PriceHistoryFile, Station, StationsFile } from './types/station.ts';

type Tab = 'map' | 'list' | 'price';

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

  // 清單頁的距離顯示共用一次定位（地圖頁的定位由 MapPage 自行處理）
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
        <h1>順路油站</h1>
        <span className="header-sub">中油直營站地圖</span>
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
      <nav className="tab-bar">
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
            {label}
          </button>
        ))}
      </nav>
      <footer className="app-footer">
        資料來源：台灣中油／政府資料開放平臺（非官方應用）
      </footer>
    </div>
  );
}
