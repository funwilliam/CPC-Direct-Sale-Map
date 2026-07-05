import { useCallback, useEffect, useRef, useState } from 'react';
import { GoogleMapAdapter } from '../../map-adapter/google.ts';
import type { MapAdapter } from '../../map-adapter/types.ts';
import { planInitialView, MAX_RADIUS_KM, type LatLng } from '../../lib/geo.ts';
import { bumpMapLoad } from '../../lib/usage.ts';
import type { Station } from '../../types/station.ts';
import StationCard from '../station-card/StationCard.tsx';
import SearchOverlay from '../search/SearchOverlay.tsx';

const FRANCHISE_MIN_ZOOM = 12; // spec/map.md §圖層規則

interface Props {
  stations: Station[];
  userLocation: LatLng | null;
  /** 每 session 只自動調整視野一次（App 層持有 flag）；定位鈕可隨時重新觸發 */
  autoFitDone: boolean;
  onAutoFitDone: () => void;
  selected: Station | null;
  onSelect: (s: Station | null) => void;
}

export default function MapPage({
  stations,
  userLocation,
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
        setReady(true);
      })
      .catch((e) => setMapError(String(e?.message ?? e)));

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

  /** 定位並套用視野規劃（初次自動執行；定位鈕重複觸發，spec/map.md §定位） */
  const locate = useCallback(() => {
    const adapter = adapterRef.current;
    if (!adapter || stations.length === 0) return;

    const applyPlan = (user: LatLng | null) => {
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
    };

    setLocating(true);
    if (!navigator.geolocation) {
      applyPlan(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => applyPlan({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => applyPlan(null),
      { enableHighAccuracy: true, timeout: 10_000 }
    );
  }, [stations]);

  // 初次自動定位（每 session 一次）
  useEffect(() => {
    if (!ready || stations.length === 0 || autoFitDone) return;
    onAutoFitDone();
    locate();
  }, [ready, stations, autoFitDone, onAutoFitDone, locate]);

  // 從清單「在地圖顯示」進來時置中
  useEffect(() => {
    if (ready && selected) adapterRef.current?.panTo({ lat: selected.lat, lng: selected.lng }, 15);
  }, [ready, selected]);

  return (
    <div className="map-page">
      {mapError ? (
        <div className="map-error">
          <p>地圖載入失敗：{mapError}</p>
          <p>清單頁與油價頁仍可正常使用。</p>
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
          onClick={locate}
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
        <div className="map-notice" onClick={() => setNotice(null)}>
          {notice}
        </div>
      )}
      {selected && <StationCard station={selected} onClose={() => onSelect(null)} />}
    </div>
  );
}
