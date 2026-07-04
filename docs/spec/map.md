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

## 自動縮放（src/lib/geo.ts 純函式）

`planInitialView(user: LatLng | null, directs: Station[]): ViewPlan`

| 情境 | 結果 |
|---|---|
| user=null（拒絕/失敗） | `{ kind: 'taiwan' }` → 台灣全島 bounds |
| 30km 內有直營站 | `{ kind: 'fit', bounds }` = user+最近站外擴 20% padding；fitBounds maxZoom=16 |
| 30km 內無直營站 | `{ kind: 'far', center: user }` → zoom 10 置中 + 提示「附近 30 公里內無直營站」 |

- 距離用 haversine。常數：`MAX_RADIUS_KM = 30`、`ZOOM_FLOOR = 10`、`ZOOM_CEIL = 16`。
- 僅每次 app session 首次定位成功執行一次；之後不再自動移動視角。

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
