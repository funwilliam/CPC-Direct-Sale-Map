import type { Bounds, LatLng } from '../lib/geo.ts';
import type { Station } from '../types/station.ts';

/** 地圖供應商抽象（spec/map.md §MapAdapter 介面）——不得洩漏供應商型別 */
export interface MapAdapter {
  mount(el: HTMLElement, opts: { center: LatLng; zoom: number }): Promise<void>;
  unmount(): void;
  setStations(stations: Station[]): void;
  /** 高亮選中站（紅色放大 pin，僅一個）；null 取消 */
  setSelected(stationId: string | null): void;
  setUserLocation(pos: LatLng | null): void;
  panTo(pos: LatLng, zoom?: number): void;
  fitBounds(b: Bounds, opts?: { maxZoom?: number; padding?: number }): void;
  onMarkerClick(cb: (stationId: string) => void): void;
  onMapClick(cb: () => void): void;
  onViewportChange(cb: (v: { zoom: number }) => void): void;
  setLayerVisibility(layer: 'franchise', visible: boolean): void;
}
