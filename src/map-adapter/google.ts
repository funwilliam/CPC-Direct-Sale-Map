import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
import { MarkerClusterer } from '@googlemaps/markerclusterer';
import type { MapAdapter } from './types.ts';
import type { Bounds, LatLng } from '../lib/geo.ts';
import type { Station } from '../types/station.ts';

let optionsSet = false;

/** 視窗內同時渲染的加盟 marker 上限（ADR-005 效能預算） */
const FRANCHISE_RENDER_CAP = 300;

export class GoogleMapAdapter implements MapAdapter {
  private map: google.maps.Map | null = null;
  private clusterer: MarkerClusterer | null = null;
  private markerLib: google.maps.MarkerLibrary | null = null;
  private franchiseStations: Station[] = [];
  /** 加盟 marker 惰性建立池（只為進過視窗的站建 DOM） */
  private franchisePool = new Map<string, google.maps.marker.AdvancedMarkerElement>();
  private visibleFranchise = new Set<string>();
  private userMarker: google.maps.marker.AdvancedMarkerElement | null = null;
  private markerClickCb: ((id: string) => void) | null = null;
  private mapClickCb: (() => void) | null = null;
  private viewportCb: ((v: { zoom: number }) => void) | null = null;
  private franchiseVisible = true;

  async mount(el: HTMLElement, opts: { center: LatLng; zoom: number }): Promise<void> {
    const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
    if (!key) throw new Error('缺少 VITE_GOOGLE_MAPS_API_KEY');
    if (!optionsSet) {
      setOptions({ key, v: 'weekly', language: 'zh-TW', region: 'TW' });
      optionsSet = true;
    }
    const [{ Map }, markerLib] = await Promise.all([
      importLibrary('maps'),
      importLibrary('marker'),
    ]);
    this.markerLib = markerLib;
    this.map = new Map(el, {
      center: opts.center,
      zoom: opts.zoom,
      mapId: 'DEMO_MAP_ID',
      disableDefaultUI: true,
      zoomControl: false,
      clickableIcons: false,
      gestureHandling: 'greedy',
    });
    this.map.addListener('zoom_changed', () => {
      const zoom = this.map?.getZoom();
      if (zoom !== undefined && zoom !== null) this.viewportCb?.({ zoom });
    });
    // 視窗裁剪：地圖靜止時才增減加盟 marker（拖曳中不動 DOM，保持流暢）
    this.map.addListener('idle', () => this.cullFranchise());
    this.map.addListener('click', () => this.mapClickCb?.());
  }

  unmount(): void {
    this.clusterer?.clearMarkers();
    this.clusterer = null;
    this.franchisePool.clear();
    this.visibleFranchise.clear();
    this.userMarker = null;
    this.map = null;
  }

  setStations(stations: Station[]): void {
    if (!this.map || !this.markerLib) return;
    const { AdvancedMarkerElement, PinElement } = this.markerLib;

    this.clusterer?.clearMarkers();
    for (const m of this.franchisePool.values()) m.map = null;
    this.franchisePool.clear();
    this.visibleFranchise.clear();

    // 直營層：全部交給 clusterer（GPU 端聚合，DOM 數量 = 叢集數）
    const directMarkers: google.maps.marker.AdvancedMarkerElement[] = [];
    for (const s of stations) {
      if (!s.isDirect) continue;
      const pin = new PinElement({
        background: '#1a56db',
        borderColor: '#153e9e',
        glyphColor: '#ffffff',
      });
      const marker = new AdvancedMarkerElement({
        position: { lat: s.lat, lng: s.lng },
        content: pin.element,
        title: s.name,
      });
      marker.addListener('click', () => this.markerClickCb?.(s.id));
      directMarkers.push(marker);
    }
    this.clusterer = new MarkerClusterer({ map: this.map, markers: directMarkers });

    // 加盟層：只存資料，marker 進視窗才惰性建立（cullFranchise）
    this.franchiseStations = stations.filter((s) => !s.isDirect);
    this.cullFranchise();
  }

  /** 只渲染視窗（含 buffer）內的加盟 marker，上限 FRANCHISE_RENDER_CAP */
  private cullFranchise(): void {
    if (!this.map || !this.markerLib) return;
    const bounds = this.map.getBounds();
    if (!bounds) return;

    const wanted = new Set<string>();
    if (this.franchiseVisible) {
      let count = 0;
      for (const s of this.franchiseStations) {
        if (count >= FRANCHISE_RENDER_CAP) break;
        if (bounds.contains({ lat: s.lat, lng: s.lng })) {
          wanted.add(s.id);
          count++;
        }
      }
    }

    for (const id of this.visibleFranchise) {
      if (!wanted.has(id)) {
        const m = this.franchisePool.get(id);
        if (m) m.map = null;
        this.visibleFranchise.delete(id);
      }
    }
    for (const id of wanted) {
      if (this.visibleFranchise.has(id)) continue;
      let marker = this.franchisePool.get(id);
      if (!marker) {
        const s = this.franchiseStations.find((x) => x.id === id);
        if (!s) continue;
        const { AdvancedMarkerElement, PinElement } = this.markerLib;
        const pin = new PinElement({
          background: '#9ca3af',
          borderColor: '#6b7280',
          glyphColor: '#e5e7eb',
          scale: 0.62,
        });
        pin.element.style.opacity = '0.55';
        marker = new AdvancedMarkerElement({
          position: { lat: s.lat, lng: s.lng },
          content: pin.element,
          title: s.name,
        });
        marker.addListener('click', () => this.markerClickCb?.(id));
        this.franchisePool.set(id, marker);
      }
      marker.map = this.map;
      this.visibleFranchise.add(id);
    }
  }

  setUserLocation(pos: LatLng | null): void {
    if (!this.map || !this.markerLib) return;
    if (!pos) {
      if (this.userMarker) this.userMarker.map = null;
      this.userMarker = null;
      return;
    }
    if (!this.userMarker) {
      // 原生 Google Maps 風格藍點：白圈藍芯 + 呼吸光暈（樣式在 index.css .user-dot）
      const dot = document.createElement('div');
      dot.className = 'user-dot';
      this.userMarker = new this.markerLib.AdvancedMarkerElement({
        content: dot,
        zIndex: 999,
      });
    }
    this.userMarker.position = pos;
    this.userMarker.map = this.map;
  }

  panTo(pos: LatLng, zoom?: number): void {
    this.map?.panTo(pos);
    if (zoom !== undefined) this.map?.setZoom(zoom);
  }

  fitBounds(b: Bounds, opts?: { maxZoom?: number; padding?: number }): void {
    if (!this.map) return;
    if (opts?.maxZoom !== undefined) {
      google.maps.event.addListenerOnce(this.map, 'idle', () => {
        const z = this.map?.getZoom();
        if (z !== undefined && z !== null && opts.maxZoom !== undefined && z > opts.maxZoom) {
          this.map?.setZoom(opts.maxZoom);
        }
      });
    }
    this.map.fitBounds(
      new google.maps.LatLngBounds({ lat: b.south, lng: b.west }, { lat: b.north, lng: b.east }),
      opts?.padding
    );
  }

  onMarkerClick(cb: (stationId: string) => void): void {
    this.markerClickCb = cb;
  }

  onMapClick(cb: () => void): void {
    this.mapClickCb = cb;
  }

  onViewportChange(cb: (v: { zoom: number }) => void): void {
    this.viewportCb = cb;
  }

  setLayerVisibility(_layer: 'franchise', visible: boolean): void {
    if (this.franchiseVisible === visible) return;
    this.franchiseVisible = visible;
    this.cullFranchise();
  }
}
