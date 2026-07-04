import { useEffect, useRef, useState } from 'react';
import { GoogleMapAdapter } from '../../map-adapter/google.ts';
import type { MapAdapter } from '../../map-adapter/types.ts';
import { planInitialView, ZOOM_FLOOR, type LatLng } from '../../lib/geo.ts';
import type { Station } from '../../types/station.ts';
import StationCard from '../station-card/StationCard.tsx';

const FRANCHISE_MIN_ZOOM = 12; // spec/map.md §圖層規則

interface Props {
  stations: Station[];
  /** 每 session 只自動調整視野一次（App 層持有 flag） */
  autoFitDone: boolean;
  onAutoFitDone: () => void;
  selected: Station | null;
  onSelect: (s: Station | null) => void;
}

export default function MapPage({ stations, autoFitDone, onAutoFitDone, selected, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const adapterRef = useRef<MapAdapter | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

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
        adapter.onViewportChange(({ zoom }) => {
          adapter.setLayerVisibility('franchise', zoom >= FRANCHISE_MIN_ZOOM);
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

  // marker/地圖點擊 → 卡片開關（selected 由 App 層共享，需最新閉包）
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

  // 初次定位 + 自動縮放（spec/map.md §自動縮放）
  useEffect(() => {
    if (!ready || stations.length === 0 || autoFitDone) return;
    onAutoFitDone();

    const applyPlan = (user: LatLng | null) => {
      const adapter = adapterRef.current;
      if (!adapter) return;
      if (user) adapter.setUserLocation(user);
      const plan = planInitialView(user, stations.filter((s) => s.isDirect));
      if (plan.kind === 'taiwan') {
        adapter.fitBounds(plan.bounds);
        if (user === null) setNotice('未取得定位，顯示全台範圍');
      } else if (plan.kind === 'fit') {
        adapter.fitBounds(plan.bounds, { maxZoom: plan.maxZoom, padding: 48 });
      } else {
        adapter.panTo(plan.center, ZOOM_FLOOR);
        setNotice('附近 30 公里內無直營站');
      }
    };

    if (!navigator.geolocation) {
      applyPlan(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => applyPlan({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => applyPlan(null),
      { enableHighAccuracy: true, timeout: 10_000 }
    );
  }, [ready, stations, autoFitDone, onAutoFitDone]);

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
      {notice && (
        <div className="map-notice" onClick={() => setNotice(null)}>
          {notice}
        </div>
      )}
      {selected && <StationCard station={selected} onClose={() => onSelect(null)} />}
    </div>
  );
}
