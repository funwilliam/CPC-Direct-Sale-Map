# SPEC — 地圖模組（map / map-adapter / station-card）

> 上限 120 行｜依據 PRD F1-F4、ADR-002/004｜2026-07-04 凍結

## MapAdapter 介面（src/map-adapter/types.ts）

```ts
interface MapAdapter {
  mount(el: HTMLElement, opts: { center: LatLng; zoom: number }): Promise<void>;
  unmount(): void;
  setStations(stations: Station[]): void;      // 直營/加盟自動分層
  setUserLocation(pos: LatLng | null): void;    // 使用者藍點
  panTo(pos: LatLng, zoom?: number): void;
  fitBounds(b: Bounds, opts?: { maxZoom?: number; padding?: number }): void;
  onMarkerClick(cb: (stationId: string) => void): void;
  onViewportChange(cb: (v: { zoom: number }) => void): void;
  setLayerVisibility(layer: 'franchise', visible: boolean): void;
}
```

- 介面**不得洩漏** Google Maps 型別；Station 型別來自 `src/types/station.ts`（鏡射 scripts/schema）。
- Google 實作（google.ts）：js-api-loader 動態載入、AdvancedMarker、直營層 MarkerClusterer 聚合、
  `mapId: 'DEMO_MAP_ID'`（正式 Map ID 後續替換）。
- 加盟 marker：小尺寸、透明度 0.55、灰色系；直營 marker：品牌藍、正常尺寸。

## 自動縮放與定位（src/lib/geo.ts 純函式）— v1.1 修訂

`planInitialView(user: LatLng | null, directs: Station[]): ViewPlan`

| 情境 | 結果 |
|---|---|
| user=null（拒絕/失敗） | `{ kind: 'taiwan' }` → 台灣全島 bounds |
| 15km 內有直營站 | `{ kind: 'fit', bounds }` = user+最近站外擴 20% padding；fitBounds maxZoom=16 |
| 15km 內無直營站 | `{ kind: 'far', center: user }` → 固定 zoom 14（街區層級美觀值）+ 提示 |

- 常數：`MAX_RADIUS_KM = 15`（≈20 分鐘車程，均速 45km/h）、`FAR_FALLBACK_ZOOM = 14`、`ZOOM_CEIL = 16`。
- 初次定位自動執行一次；**定位按鈕**（右下 FAB）可隨時重新執行同一規則。
- 使用者藍點：`.user-dot`（18px 藍芯+白圈+呼吸光暈，樣式見 spec/design.md）。

## 效能（ADR-005）

直營層走 clusterer；加盟層惰性建立 + `idle` 時視窗裁剪（上限 300），拖曳中不得增刪 DOM。

## 圖層規則

- zoom < 12：隱藏加盟層（MapPage 監聽 onViewportChange 呼叫 setLayerVisibility）。
- 直營層永遠顯示（clusterer 處理密度）。

## 資訊卡（station-card）

點 marker（直營或加盟皆可）→ 底部卡片：
- 站名；加盟站加紅色「加盟站」徽章 + 「非直營，注意避免誤闖」說明。
- 地址（完整含縣市鄉鎮）+ 複製鈕（navigator.clipboard，成功顯示 1.5s 提示）。
- 油品 chips：92/95/98/超級柴油，無供應者灰階。
- 「Google Maps 導航」：開新分頁 `https://www.google.com/maps/dir/?api=1&destination={lat},{lng}`。
- 關閉：卡片 X、點地圖空白處。

## 錯誤處理

- 無 API key / Maps 載入失敗：地圖區顯示錯誤卡（不 crash 整個 app），清單/油價分頁不受影響。
- 定位 timeout 10s → 視同拒絕（taiwan fallback），可再點「定位」鈕重試。
