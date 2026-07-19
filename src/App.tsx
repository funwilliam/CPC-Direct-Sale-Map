import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import MapPage from './features/map/MapPage.tsx';
import InstallPrompt from './features/install/InstallPrompt.tsx';
import { loadData } from './lib/dataStore.ts';

// 非首屏分頁延遲載入（首屏＝地圖，油價/設定進分頁才拉 chunk）
const PricePage = lazy(() => import('./features/price/PricePage.tsx'));
const SettingsPage = lazy(() => import('./features/settings/SettingsPage.tsx'));
import { haversineKm, type LatLng } from './lib/geo.ts';
import type { CurrentPriceFile, PriceHistoryFile, Station, StationsFile } from './types/station.ts';

type Tab = 'map' | 'price' | 'settings';

const TAB_ICONS: Record<Tab, string> = {
  // 24x24 stroke path（設計規範見 docs/spec/design.md §圖標）
  map: 'M12 21s-7-5.1-7-11a7 7 0 1 1 14 0c0 5.9-7 11-7 11Zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  price: 'M12 1v22M17 5.5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  settings:
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.4 7.4 0 0 0-2.1-1.2L14.4 3h-4l-.4 2.6a7.4 7.4 0 0 0-2.1 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7.4 7.4 0 0 0 2.1 1.2l.4 2.6h4l.4-2.6a7.4 7.4 0 0 0 2.1-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z',
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
  const [geoDenied, setGeoDenied] = useState(false);

  // 離線優先資料層（ADR-009）：讀本機快取，資料過期才背景嘗試更新
  useEffect(() => {
    loadData((fresh) => {
      // 背景週更完成：只換價格與歷史紀錄（油價頁局部重繪），地圖/站點維持不動避免抖動
      setPrice(fresh.price);
      setHistory(fresh.history);
    })
      .then(({ stations: s, price: p, history: h }: { stations: StationsFile; price: CurrentPriceFile; history: PriceHistoryFile }) => {
        setStations(s.stations);
        setPrice(p);
        setHistory(h);
      })
      .catch((e) => {
        console.error('資料載入失敗', e); // 技術細節進 console
        setDataError('暫時無法載入站點資料，請檢查網路後重新開啟。');
      });
  }, []);

  // 使用者定位：watchPosition 持續追蹤（藍點即時跟隨；相機只在定位鈕/初次視野時移動）。
  // 全 app 唯一的定位來源——watch 活躍時再呼叫 getCurrentPosition 會餓死逾時（Chromium 實測），
  // 因此 MapPage 的 locate 直接吃這條資料流。<5m 視為原地抖動不更新；
  // ≥5m 逐點進 adapter 補間滑行（藍點平滑度靠補間，不靠加大門檻）
  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoDenied(true);
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation((prev) => (prev && haversineKm(prev, next) < 0.005 ? prev : next));
      },
      (e) => {
        if (e.code === e.PERMISSION_DENIED) setGeoDenied(true); // 明確拒絕 → 不必等逾時
      },
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  const onAutoFitDone = useCallback(() => setAutoFitDone(true), []);

  return (
    <div className="app">
      {/* 非地圖分頁：狀態列區域用該頁自身的底色延伸（iOS 會依底色自動切換狀態列文字深淺）；
          地圖分頁：地圖延伸到狀態列下，頂部漸層 scrim 保持時間可讀（原生地圖慣例） */}
      {tab !== 'map' && <div className={`status-strip strip-${tab}`} aria-hidden="true" />}
      {dataError && <p className="error page-pad">{dataError}</p>}
      <main className="app-main">
        {/* 地圖分頁用 display 切換保留實例，避免重複載入 Maps JS */}
        <div style={{ display: tab === 'map' ? 'contents' : 'none' }}>
          <MapPage
            stations={stations}
            userLocation={userLocation}
            geoDenied={geoDenied}
            autoFitDone={autoFitDone}
            onAutoFitDone={onAutoFitDone}
            selected={tab === 'map' ? selected : null}
            onSelect={setSelected}
          />
        </div>
        <Suspense fallback={<p className="page-pad">載入中…</p>}>
          {tab === 'price' && <PricePage price={price} history={history} />}
          {tab === 'settings' && <SettingsPage />}
        </Suspense>
      </main>
      {tab === 'map' && <InstallPrompt />}
      <nav className="tab-bar" aria-label="主要導覽">
        {(
          [
            ['map', '地圖'],
            ['price', '油價'],
            ['settings', '設定'],
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
            <span className="tab-label">{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
