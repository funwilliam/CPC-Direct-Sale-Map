import { useCallback, useEffect, useState } from 'react';
import MapPage from './features/map/MapPage.tsx';
import InstallPrompt from './features/install/InstallPrompt.tsx';
import PricePage from './features/price/PricePage.tsx';
import DebugPanel from './features/debug/DebugPanel.tsx';
import type { LatLng } from './lib/geo.ts';
import type { CurrentPriceFile, PriceHistoryFile, Station, StationsFile } from './types/station.ts';

type Tab = 'map' | 'price';

const initialDebug =
  typeof location !== 'undefined' &&
  (location.search.includes('debug') || localStorage.getItem('debug') === '1');

const TAB_ICONS: Record<Tab, string> = {
  // 24x24 stroke path（設計規範見 docs/spec/design.md §圖標）
  map: 'M12 21s-7-5.1-7-11a7 7 0 1 1 14 0c0 5.9-7 11-7 11Zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
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
  const [debug, setDebug] = useState(initialDebug);

  // 獨立模式無法帶 ?debug=1，改用連點手勢：10 秒內連點「同一個」tab 按鈕 7 下切換診斷模式
  const tapsRef = (useState(() => ({ n: 0, t: 0, key: '' as Tab | '' }))[0]);
  const toggleDebugByTaps = useCallback(
    (key: Tab) => {
      const now = Date.now();
      const continuing = tapsRef.key === key && now - tapsRef.t < 10_000;
      tapsRef.n = continuing ? tapsRef.n + 1 : 1;
      tapsRef.t = now;
      tapsRef.key = key;
      if (tapsRef.n >= 7) {
        tapsRef.n = 0;
        setDebug((d) => {
          const next = !d;
          localStorage.setItem('debug', next ? '1' : '0');
          return next;
        });
      }
    },
    [tapsRef]
  );

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

  const onAutoFitDone = useCallback(() => setAutoFitDone(true), []);

  return (
    <div className={`app${debug ? ' debug' : ''}`}>
      {debug && <DebugPanel />}
      {/* 非地圖分頁：狀態列區域用該頁自身的底色延伸（iOS 會依底色自動切換狀態列文字深淺）；
          地圖分頁：地圖延伸到狀態列下，頂部漸層 scrim 保持時間可讀（原生地圖慣例） */}
      {tab !== 'map' && <div className={`status-strip strip-${tab}`} aria-hidden="true" />}
      {dataError && <p className="error page-pad">站點資料載入失敗：{dataError}</p>}
      <main className="app-main">
        {/* 地圖分頁用 display 切換保留實例，避免重複載入 Maps JS */}
        <div style={{ display: tab === 'map' ? 'contents' : 'none' }}>
          <MapPage
            stations={stations}
            userLocation={userLocation}
            autoFitDone={autoFitDone}
            onAutoFitDone={onAutoFitDone}
            selected={tab === 'map' ? selected : null}
            onSelect={setSelected}
          />
        </div>
        {tab === 'price' && <PricePage price={price} history={history} />}
      </main>
      <InstallPrompt />
      <nav className="tab-bar" aria-label="主要導覽">
        {(
          [
            ['map', '地圖'],
            ['price', '油價'],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            className={tab === key ? 'tab-on' : ''}
            onClick={() => {
              setTab(key);
              toggleDebugByTaps(key);
            }}
            aria-current={tab === key ? 'page' : undefined}
          >
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d={TAB_ICONS[key]} />
            </svg>
            <span className="tab-label">{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
