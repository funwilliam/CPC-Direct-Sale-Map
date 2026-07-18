import { useCallback, useEffect, useRef, useState } from 'react';
import { GoogleMapAdapter } from '../../map-adapter/google.ts';
import type { MapAdapter } from '../../map-adapter/types.ts';
import { planInitialView, MAX_RADIUS_KM, type LatLng } from '../../lib/geo.ts';
import { bumpMapLoad } from '../../lib/usage.ts';
import type { Station } from '../../types/station.ts';
import StationCard from '../station-card/StationCard.tsx';
import SearchOverlay from '../search/SearchOverlay.tsx';

const FRANCHISE_MIN_ZOOM = 13; // spec/map.md §圖層規則（向量模式減負，12→13）

interface Props {
  stations: Station[];
  userLocation: LatLng | null;
  /** 定位權限被明確拒絕（App 層 watchPosition 回報）→ 初次視野不等定位直接 fallback */
  geoDenied: boolean;
  /** 每 session 只自動調整視野一次（App 層持有 flag）；定位鈕可隨時重新觸發 */
  autoFitDone: boolean;
  onAutoFitDone: () => void;
  selected: Station | null;
  onSelect: (s: Station | null) => void;
}

export default function MapPage({
  stations,
  userLocation,
  geoDenied,
  autoFitDone,
  onAutoFitDone,
  selected,
  onSelect,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const adapterRef = useRef<MapAdapter | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [locating, setLocating] = useState(false);
  // 啟動幕：蓋住「未定位的全台地圖」直到首次視野套用完成（UX：第一眼即自己的位置）
  const [boot, setBoot] = useState<'show' | 'hide' | 'gone'>('show');

  const dismissSplash = useCallback(() => {
    setBoot((b) => (b === 'show' ? 'hide' : b));
    setTimeout(() => setBoot('gone'), 350); // 等淡出動畫
  }, []);

  // 啟動幕硬上限：定位過慢也不無限等（6 秒後直接進場，定位稍後到再平移過去）
  useEffect(() => {
    const t = setTimeout(dismissSplash, 6000);
    return () => clearTimeout(t);
  }, [dismissSplash]);

  // 地圖載入失敗 → 立即撤啟動幕顯示錯誤卡
  useEffect(() => {
    if (mapError) dismissSplash();
  }, [mapError, dismissSplash]);

  // 掛載地圖（一次）
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const adapter = new GoogleMapAdapter();
    adapterRef.current = adapter;
    let cancelled = false;

    adapter
      .mount(el, { center: { lat: 23.7, lng: 121 }, zoom: 7 })
      .then(() => {
        if (cancelled) return;
        bumpMapLoad(); // 本機計費估算：一次 new Map() ≈ 一次 Dynamic Maps load
        adapter.onViewportChange(({ zoom }) => {
          adapter.setLayerVisibility('franchise', zoom >= FRANCHISE_MIN_ZOOM);
          // 測試觀測點：目前 zoom（E2E 用，無 UI 影響）
          if (containerRef.current) containerRef.current.dataset.zoom = String(zoom);
        });
        adapter.setLayerVisibility('franchise', false); // 初始 zoom 7 < 門檻，先關閉加盟層
        setReady(true);
      })
      .catch((e) => {
        console.error('地圖載入失敗', e); // 技術細節進 console，不裸露給使用者
        setMapError(String(e?.message ?? e));
      });

    return () => {
      cancelled = true;
      adapter.unmount();
      adapterRef.current = null;
    };
  }, []);

  // marker/地圖點擊 → 卡片開關
  useEffect(() => {
    if (!ready) return;
    const adapter = adapterRef.current;
    if (!adapter) return;
    adapter.onMarkerClick((id) => {
      const s = stations.find((x) => x.id === id) ?? null;
      onSelect(s);
    });
    adapter.onMapClick(() => onSelect(null));
  }, [ready, stations, onSelect]);

  // 站點載入
  useEffect(() => {
    if (ready && stations.length > 0) adapterRef.current?.setStations(stations);
  }, [ready, stations]);

  // 藍點即時跟隨定位（App 層 watchPosition）；只動藍點，相機不跟——
  // 相機移動僅發生在定位鈕與初次自動視野（原生地圖慣例，不搶使用者視角）
  useEffect(() => {
    if (ready && userLocation) adapterRef.current?.setUserLocation(userLocation);
  }, [ready, userLocation]);

  /**
   * 以指定位置套用視野規劃（初次自動執行；定位鈕重複觸發，spec/map.md §定位）。
   * 位置一律來自 App 層 watchPosition 資料流——不得在此再呼叫 getCurrentPosition，
   * watch 活躍時該呼叫會餓死逾時（Chromium 實測）。
   */
  const locate = useCallback(
    (user: LatLng | null) => {
      const adapter = adapterRef.current;
      if (!adapter || stations.length === 0) return;
      setLocating(true);
      if (user) adapter.setUserLocation(user);
      const plan = planInitialView(user, stations.filter((s) => s.isDirect));
      if (plan.kind === 'taiwan') {
        adapter.fitBounds(plan.bounds);
        if (user === null) setNotice('未取得定位，顯示全台範圍');
      } else if (plan.kind === 'fit') {
        adapter.fitBounds(plan.bounds, { maxZoom: plan.maxZoom, padding: 48 });
      } else {
        adapter.panTo(plan.center, plan.zoom);
        setNotice(`附近 ${MAX_RADIUS_KM} 公里（約 20 分鐘車程）內無直營站`);
      }
      setLocating(false);
      // 首次視野就位後撤啟動幕（多留 0.45s 讓相機安定，揭幕即最終畫面）
      setTimeout(dismissSplash, 450);
    },
    [stations, dismissSplash]
  );

  // 初次自動定位（每 session 一次）：等 watchPosition 首個定位點；
  // 明確拒絕即刻 fallback，否則最多等 10s（spec/map.md §錯誤處理）
  useEffect(() => {
    if (!ready || stations.length === 0 || autoFitDone) return;
    if (userLocation || geoDenied) {
      onAutoFitDone();
      locate(userLocation);
      return;
    }
    const t = setTimeout(() => {
      onAutoFitDone();
      locate(null);
    }, 10_000);
    return () => clearTimeout(t);
  }, [ready, stations, autoFitDone, userLocation, geoDenied, onAutoFitDone, locate]);

  // 選中站：紅色高亮 + 置中（取消選取時還原）
  useEffect(() => {
    if (!ready) return;
    adapterRef.current?.setSelected(selected?.id ?? null);
    if (selected) adapterRef.current?.panTo({ lat: selected.lat, lng: selected.lng }, 15);
  }, [ready, selected]);

  return (
    <div className="map-page">
      {mapError ? (
        <div className="map-error">
          <p>地圖暫時無法載入，請檢查網路後重新開啟。</p>
          <p>搜尋與油價功能仍可正常使用。</p>
        </div>
      ) : (
        <div ref={containerRef} className="map-container" />
      )}
      {!mapError && ready && (
        <SearchOverlay stations={stations} userLocation={userLocation} onPick={(s) => onSelect(s)} />
      )}
      {!mapError && ready && (
        <button
          className={`locate-btn ${locating ? 'locating' : ''}`}
          onClick={() => locate(userLocation)}
          aria-label="回到我的位置"
          title="回到我的位置"
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="7" />
            <circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" strokeLinecap="round" />
          </svg>
        </button>
      )}
      {notice && (
        <div className="map-notice" role="status" aria-live="polite" onClick={() => setNotice(null)}>
          {notice}
        </div>
      )}
      {selected && <StationCard station={selected} onClose={() => onSelect(null)} />}
      {boot !== 'gone' && !mapError && (
        <div className={`map-splash${boot === 'hide' ? ' splash-hide' : ''}`} aria-hidden="true">
          <span className="logo-mark splash-logo">
            <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 21s-7-5.1-7-11a7 7 0 1 1 14 0c0 5.9-7 11-7 11Z" />
              <circle cx="12" cy="10" r="2.5" />
            </svg>
          </span>
          <div className="splash-name">順路加油</div>
          <div className="splash-spinner" />
          <div className="splash-status">定位中…</div>
        </div>
      )}
    </div>
  );
}
