import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
import { MarkerClusterer } from '@googlemaps/markerclusterer';
import type { MapAdapter } from './types.ts';
import type { Bounds, LatLng } from '../lib/geo.ts';
import type { Station } from '../types/station.ts';

let optionsSet = false;

/** 視窗內同時渲染的加盟 marker 上限（ADR-005；向量模式 DOM 疊加成本高，150→80） */
const FRANCHISE_RENDER_CAP = 80;
/** idle 時每幀最多掛載的加盟 marker 數（分批進場，避免手勢結束瞬間頓挫） */
const FRANCHISE_ADD_BATCH = 50;

export class GoogleMapAdapter implements MapAdapter {
  private map: google.maps.Map | null = null;
  private clusterer: MarkerClusterer | null = null;
  private markerLib: google.maps.MarkerLibrary | null = null;
  private franchiseStations: Station[] = [];
  /** 加盟 marker 惰性建立池（只為進過視窗的站建 DOM） */
  private franchisePool = new Map<string, google.maps.marker.AdvancedMarkerElement>();
  private directPool = new Map<string, google.maps.marker.AdvancedMarkerElement>();
  private selectedId: string | null = null;
  private visibleFranchise = new Set<string>();
  private userMarker: google.maps.marker.AdvancedMarkerElement | null = null;
  private markerClickCb: ((id: string) => void) | null = null;
  private mapClickCb: (() => void) | null = null;
  private viewportCb: ((v: { zoom: number }) => void) | null = null;
  private franchiseVisible = true;
  private animId = 0;
  private lastHit = '';
  private lastZoomQ = -1;

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
      // 渲染引擎二選一（硬取捨，設定頁可切換，存 localStorage，預設點陣）：
      // 點陣＝平移絲滑、縮放有載入區塊；向量＝縮放絲滑無載入區塊、部分機型平移偶頓挫。
      // 兩個皆為專案正式 Map ID（設定檔決定渲染型別；非機密，環境變數可覆寫向量端）。
      mapId:
        localStorage.getItem('mapRender') === 'vector'
          ? (import.meta.env.VITE_GOOGLE_MAPS_MAP_ID as string | undefined) || '512312ef3444ebee99784cc2'
          : '512312ef3444ebee79404182', // 順路加油-點陣（光柵）
      // 圖磚載入前的底色改接近地圖陸地色（預設深灰塊很搶眼）
      backgroundColor: '#f2f0ed',
      disableDefaultUI: true,
      zoomControl: false,
      clickableIcons: false,
      gestureHandling: 'greedy',
      isFractionalZoomEnabled: true, // 向量地圖分數縮放：相機動畫走 GPU、不逐級跳磚
    });
    this.updateHitSize(opts.zoom);
    this.map.addListener('zoom_changed', () => {
      const zoom = this.map?.getZoom();
      if (zoom === undefined || zoom === null) return;
      // 量化到 1/4 級再往外傳：動畫每幀觸發 zoom_changed，
      // 未量化會造成每幀 CSS/DOM 副作用（先前卡頓的主因）
      const q = Math.round(zoom * 4);
      if (q === this.lastZoomQ) return;
      this.lastZoomQ = q;
      this.updateHitSize(zoom);
      this.viewportCb?.({ zoom });
    });
    // 視窗裁剪：地圖靜止時才增減加盟 marker（拖曳中不動 DOM，保持流暢）
    this.map.addListener('idle', () => this.cullFranchise());
    this.map.addListener('click', () => this.mapClickCb?.());
    // 互動期間暫停疊加層的裝飾動畫（無限 CSS 動畫疊在 WebGL 上是持續合成負擔）
    const moving = (on: boolean) => el.classList.toggle('map-moving', on);
    this.map.addListener('dragstart', () => moving(true));
    this.map.addListener('zoom_changed', () => moving(true));
    this.map.addListener('idle', () => moving(false));
    // 診斷：實際渲染模式（VECTOR=GPU 向量 / RASTER=點陣回退會卡）→ debug 面板讀取
    const stampRender = () => {
      el.dataset.render = String(this.map?.getRenderingType() ?? 'unknown');
    };
    stampRender();
    this.map.addListener('renderingtype_changed', stampRender);
  }

  /** marker 命中區大小隨縮放調整（低縮放密集→維持 44 下限；高縮放拉開→放大更好按） */
  private updateHitSize(zoom: number): void {
    const v = zoom >= 16 ? '56px' : '44px';
    if (v === this.lastHit) return; // 值沒變不碰 DOM（避免動畫期間每幀重算樣式）
    this.lastHit = v;
    document.documentElement.style.setProperty('--hit', v);
  }

  /** 以 pin 尖端為錨點，外包一層透明命中區（達 Apple HIG 44pt 可觸控下限） */
  private wrapPin(pinEl: HTMLElement, direct: boolean): HTMLElement {
    const mk = document.createElement('div');
    mk.className = direct ? 'mk mk-direct' : 'mk mk-franchise';
    mk.appendChild(pinEl);
    return mk;
  }

  /** 產生 marker 內容：直營藍 / 加盟灰 / 選中紅（放大） */
  private makeContent(kind: 'direct' | 'franchise' | 'selected'): HTMLElement {
    const { PinElement } = this.markerLib!;
    const cfg =
      kind === 'selected'
        ? { background: '#d92d20', borderColor: '#a92318', glyphColor: '#ffffff', scale: 1.25 }
        : kind === 'direct'
          ? { background: '#1a56db', borderColor: '#153e9e', glyphColor: '#ffffff' }
          : { background: '#9ca3af', borderColor: '#6b7280', glyphColor: '#e5e7eb', scale: 0.62 };
    const pin = new PinElement(cfg);
    if (kind === 'franchise') pin.element.style.opacity = '0.55';
    return this.wrapPin(pin.element, kind !== 'franchise');
  }

  /** 高亮選中站：紅色放大 pin + 置頂；還原前一個 */
  setSelected(id: string | null): void {
    if (id === this.selectedId || !this.markerLib) return;
    const prev = this.selectedId;
    this.selectedId = id;
    if (prev) {
      const d = this.directPool.get(prev);
      if (d) {
        d.content = this.makeContent('direct');
        d.zIndex = null;
      } else {
        const f = this.franchisePool.get(prev);
        if (f) {
          f.content = this.makeContent('franchise');
          f.zIndex = null;
        }
      }
    }
    if (id) {
      const m = this.directPool.get(id) ?? this.franchisePool.get(id);
      if (m) {
        m.content = this.makeContent('selected');
        m.zIndex = 1200;
      }
      // 加盟站尚未進池時：cullFranchise 建立當下會依 selectedId 直接給紅色
    }
  }

  /** 等原生動畫結束（idle），帶 timeout 保險避免卡住 */
  private waitIdle(timeoutMs = 700): Promise<void> {
    const map = this.map;
    if (!map) return Promise.resolve();
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        google.maps.event.removeListener(listener);
        resolve();
      }, timeoutMs);
      const listener = google.maps.event.addListenerOnce(map, 'idle', () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  /** 視窗寬對應的經度跨度（度），用於估算「一個視窗」的距離尺度 */
  private viewportLngSpan(zoom: number): number {
    const div = this.map?.getDiv() as HTMLElement | undefined;
    return Math.max(1, div?.offsetWidth ?? 400) * (360 / (256 * 2 ** zoom));
  }

  /**
   * 相機移動策略（UX：方向感一致、流暢度 = 手勢級）。
   * 全部使用地圖「原生」動畫（panTo/setZoom 與手指拖曳同一套 GPU 引擎），
   * 不自行逐幀插值（JS 側 rAF+moveCamera 逐幀塞分數縮放即先前卡頓來源）。
   * - 極短：直接到位。
   * - 短距離（≤0.9 視窗）：原生 panTo；如需變焦，pan 完再原生 setZoom。
   * - 長距離：三段式——原生小平移（建方向感）→ 瞬移到目標前緣 → 原生小平移滑入。
   */
  private async animateCamera(center: LatLng, zoom: number): Promise<void> {
    const map = this.map;
    if (!map) return;
    const c0 = map.getCenter();
    const z0 = map.getZoom();
    if (!c0 || z0 === undefined || z0 === null) {
      map.moveCamera({ center, zoom });
      return;
    }
    const seq = ++this.animId;
    const sLat = c0.lat();
    const sLng = c0.lng();
    const dLat = center.lat - sLat;
    const dLng = center.lng - sLng;
    const dist = Math.hypot(dLat, dLng);
    const dz = zoom - z0;

    // 位移與縮放差都極小 → 不值得動畫
    if (Math.abs(dz) < 0.05 && dist < 1e-4) {
      map.moveCamera({ center, zoom });
      return;
    }

    const spans = dist / this.viewportLngSpan(Math.min(z0, zoom));

    if (spans <= 0.9) {
      map.panTo(center); // 原生平滑（此距離內保證動畫，與手勢同引擎）
      if (Math.abs(dz) >= 0.05) {
        await this.waitIdle();
        if (seq !== this.animId || this.map !== map) return;
        map.setZoom(zoom); // 原生縮放動畫
      }
      return;
    }

    // 長距離三段式（pan 皆原生；縮放只在中段瞬移時切換，不做動畫縮放）
    const ux = dLat / (dist || 1);
    const uy = dLng / (dist || 1);
    const stepOut = 0.35 * this.viewportLngSpan(z0);
    map.panTo({ lat: sLat + ux * stepOut, lng: sLng + uy * stepOut });
    await this.waitIdle();
    if (seq !== this.animId || this.map !== map) return;

    const stepIn = 0.35 * this.viewportLngSpan(zoom);
    map.moveCamera({
      center: { lat: center.lat - ux * stepIn, lng: center.lng - uy * stepIn },
      zoom,
    }); // 中段瞬移到目標前緣
    await this.waitIdle(250);
    if (seq !== this.animId || this.map !== map) return;
    map.panTo(center); // 原生滑入定點
  }

  /** bounds + padding → 相機中心與縮放（標準 mercator fit 公式，供平滑動畫用） */
  private boundsToCamera(b: Bounds, padding: number): { center: LatLng; zoom: number } {
    const div = this.map!.getDiv() as HTMLElement;
    const W = Math.max(1, div.offsetWidth - padding * 2);
    const H = Math.max(1, div.offsetHeight - padding * 2);
    const latRad = (lat: number) => {
      const s = Math.sin((lat * Math.PI) / 180);
      return Math.log((1 + s) / (1 - s)) / 2;
    };
    const latFraction = Math.max(1e-6, Math.abs(latRad(b.north) - latRad(b.south)) / Math.PI);
    let lngDiff = b.east - b.west;
    if (lngDiff < 0) lngDiff += 360;
    const lngFraction = Math.max(1e-6, lngDiff / 360);
    const WORLD = 256;
    const latZoom = Math.log(H / WORLD / latFraction) / Math.LN2;
    const lngZoom = Math.log(W / WORLD / lngFraction) / Math.LN2;
    return {
      center: { lat: (b.north + b.south) / 2, lng: (b.east + b.west) / 2 },
      zoom: Math.max(3, Math.min(latZoom, lngZoom, 20)),
    };
  }

  unmount(): void {
    this.clusterer?.clearMarkers();
    this.clusterer = null;
    this.franchisePool.clear();
    this.directPool.clear();
    this.visibleFranchise.clear();
    this.selectedId = null;
    this.userMarker = null;
    if (this.map) {
      // 清監聽避免洩漏；清容器 DOM 讓（開發模式 StrictMode 的）重掛載乾淨起步
      google.maps.event.clearInstanceListeners(this.map);
      const div = this.map.getDiv() as HTMLElement;
      div.replaceChildren();
    }
    this.map = null;
  }

  setStations(stations: Station[]): void {
    if (!this.map || !this.markerLib) return;
    const { AdvancedMarkerElement } = this.markerLib;

    this.clusterer?.clearMarkers();
    for (const m of this.franchisePool.values()) m.map = null;
    this.franchisePool.clear();
    this.directPool.clear();
    this.visibleFranchise.clear();

    // 直營層：全部交給 clusterer（GPU 端聚合，DOM 數量 = 叢集數）
    const directMarkers: google.maps.marker.AdvancedMarkerElement[] = [];
    for (const s of stations) {
      if (!s.isDirect) continue;
      const marker = new AdvancedMarkerElement({
        position: { lat: s.lat, lng: s.lng },
        content: this.makeContent(s.id === this.selectedId ? 'selected' : 'direct'),
        title: s.name,
      });
      if (s.id === this.selectedId) marker.zIndex = 1200; // 重建時保持選中置頂
      marker.addListener('click', () => this.markerClickCb?.(s.id));
      this.directPool.set(s.id, marker);
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
    // 選中的加盟站不受 CAP 與可見層開關影響（否則紅色高亮可能不顯示）
    if (this.selectedId && this.franchiseStations.some((s) => s.id === this.selectedId)) {
      wanted.add(this.selectedId);
    }

    for (const id of this.visibleFranchise) {
      if (!wanted.has(id)) {
        const m = this.franchisePool.get(id);
        if (m) m.map = null;
        this.visibleFranchise.delete(id);
      }
    }
    // 分批進場：一次掛上百個 DOM marker 會在手勢結束瞬間掉幀
    const toAdd: string[] = [];
    for (const id of wanted) {
      if (!this.visibleFranchise.has(id)) toAdd.push(id);
    }
    const addChunk = (from: number) => {
      if (!this.map || !this.markerLib) return;
      const end = Math.min(from + FRANCHISE_ADD_BATCH, toAdd.length);
      for (let i = from; i < end; i++) {
        const id = toAdd[i];
        let marker = this.franchisePool.get(id);
        if (!marker) {
          const s = this.franchiseStations.find((x) => x.id === id);
          if (!s) continue;
          const { AdvancedMarkerElement } = this.markerLib;
          marker = new AdvancedMarkerElement({
            position: { lat: s.lat, lng: s.lng },
            content: this.makeContent(id === this.selectedId ? 'selected' : 'franchise'),
            title: s.name,
          });
          if (id === this.selectedId) marker.zIndex = 1200;
          marker.addListener('click', () => this.markerClickCb?.(id));
          this.franchisePool.set(id, marker);
        }
        marker.map = this.map;
        this.visibleFranchise.add(id);
      }
      if (end < toAdd.length) requestAnimationFrame(() => addChunk(end));
    };
    if (toAdd.length > 0) addChunk(0);
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
    if (!this.map) return;
    const target = zoom ?? this.map.getZoom() ?? 15;
    this.animateCamera(pos, target);
  }

  fitBounds(b: Bounds, opts?: { maxZoom?: number; padding?: number }): void {
    if (!this.map) return;
    const { center, zoom } = this.boundsToCamera(b, opts?.padding ?? 0);
    const clamped = opts?.maxZoom !== undefined ? Math.min(zoom, opts.maxZoom) : zoom;
    this.animateCamera(center, clamped);
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
