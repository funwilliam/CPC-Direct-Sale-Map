import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
import { MarkerClusterer } from '@googlemaps/markerclusterer';
import type { MapAdapter } from './types.ts';
import type { Bounds, LatLng } from '../lib/geo.ts';
import type { Station } from '../types/station.ts';

let optionsSet = false;

export class GoogleMapAdapter implements MapAdapter {
  private map: google.maps.Map | null = null;
  private clusterer: MarkerClusterer | null = null;
  private franchiseMarkers: google.maps.marker.AdvancedMarkerElement[] = [];
  private userMarker: google.maps.marker.AdvancedMarkerElement | null = null;
  private markerLib: google.maps.MarkerLibrary | null = null;
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
      zoomControl: true,
      clickableIcons: false,
    });
    this.map.addListener('zoom_changed', () => {
      const zoom = this.map?.getZoom();
      if (zoom !== undefined && zoom !== null) this.viewportCb?.({ zoom });
    });
    this.map.addListener('click', () => this.mapClickCb?.());
  }

  unmount(): void {
    this.clusterer?.clearMarkers();
    this.clusterer = null;
    this.franchiseMarkers = [];
    this.userMarker = null;
    this.map = null;
  }

  setStations(stations: Station[]): void {
    if (!this.map || !this.markerLib) return;
    const { AdvancedMarkerElement, PinElement } = this.markerLib;

    this.clusterer?.clearMarkers();
    for (const m of this.franchiseMarkers) m.map = null;
    this.franchiseMarkers = [];

    const directMarkers: google.maps.marker.AdvancedMarkerElement[] = [];
    for (const s of stations) {
      const pin = new PinElement(
        s.isDirect
          ? { background: '#1a56db', borderColor: '#153e9e', glyphColor: '#ffffff' }
          : { background: '#9ca3af', borderColor: '#6b7280', glyphColor: '#e5e7eb', scale: 0.62 }
      );
      if (!s.isDirect) pin.element.style.opacity = '0.55';
      const marker = new AdvancedMarkerElement({
        position: { lat: s.lat, lng: s.lng },
        content: pin.element,
        title: s.name,
      });
      marker.addListener('click', () => this.markerClickCb?.(s.id));
      if (s.isDirect) directMarkers.push(marker);
      else {
        marker.map = this.franchiseVisible ? this.map : null;
        this.franchiseMarkers.push(marker);
      }
    }
    this.clusterer = new MarkerClusterer({ map: this.map, markers: directMarkers });
  }

  setUserLocation(pos: LatLng | null): void {
    if (!this.map || !this.markerLib) return;
    if (!pos) {
      if (this.userMarker) this.userMarker.map = null;
      this.userMarker = null;
      return;
    }
    if (!this.userMarker) {
      const dot = document.createElement('div');
      dot.style.cssText =
        'width:16px;height:16px;border-radius:50%;background:#2563eb;border:3px solid #fff;box-shadow:0 0 0 2px rgba(37,99,235,.4)';
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
      // fitBounds 完成後夾住 zoom 上限
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
    this.franchiseVisible = visible;
    for (const m of this.franchiseMarkers) m.map = visible ? this.map : null;
  }
}
