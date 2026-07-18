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
  onMapClick(cb: () => void): void;             // 點地圖空白處（關資訊卡）
  onViewportChange(cb: (v: { zoom: number }) => void): void;
  setLayerVisibility(layer: 'franchise', visible: boolean): void;
  setSelected(id: string | null): void;         // 選中高亮（見 §選中高亮）
}
```

- 介面**不得洩漏** Google Maps 型別；Station 型別來自 `src/types/station.ts`（鏡射 scripts/schema）。
- Google 實作（google.ts）：js-api-loader 動態載入、AdvancedMarker、直營層 MarkerClusterer 聚合。
- Map ID 雙引擎（v1.3，spec/settings.md）：點陣 `512312ef3444ebee79404182`（預設）／
  向量 `512312ef3444ebee99784cc2`，由 localStorage `mapRender` 決定。
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
- 藍點**持續跟隨**定位（App 層 watchPosition，移動 ≥20m 才更新）；相機不跟隨——
  相機移動僅發生在定位鈕與初次自動視野（不搶使用者視角）。
- watchPosition 是**全 app 唯一定位來源**：watch 活躍時再呼叫 getCurrentPosition
  會餓死逾時（Chromium 實測），locate 一律讀 watch 的最新位置。
- 初次視野：等 watch 首個定位點，明確拒絕即刻 fallback、最多等 10s。

## 相機移動（v1.2，UX：方向感一致、手勢級流暢）

全用地圖**原生**動畫（panTo/setZoom，與手勢同引擎），不自行逐幀插值。
極短→直接到位；短距離(≤0.9 視窗)→原生 panTo（變焦則 pan 完接 setZoom）；
長距離→三段式：朝目標小平移→瞬移至前緣→滑入（縮放僅在瞬移時切換）。

## 啟動幕（v1.2）

進 app 即以品牌畫面蓋住地圖，載圖+定位+首次視野並行就位後 450ms 淡出；
6 秒硬上限、地圖失敗即撤、拒絕定位走快速路徑。使用者第一眼即自己的位置。

## 選中高亮（v1.2）

`setSelected(id|null)`：選中站 pin 紅色 #d92d20、1.25x、zIndex 置頂；換選/取消還原。

## 效能（ADR-005；v1.2 修訂）

直營層走 clusterer；加盟層惰性建立 + `idle` 時視窗裁剪（上限 80、每幀分批掛載 50，
v1.3 由 150 收緊減輕向量模式負擔），拖曳中不得增刪 DOM。
命中區 `--hit`：44px，zoom≥16 時 56px（zoom 事件量化 1/4 級防每幀副作用）。

## 圖層規則

- zoom < 13：隱藏加盟層（MapPage 監聽 onViewportChange 呼叫 setLayerVisibility；
  v1.3 由 12 提高，向量模式減負）。選中站為加盟站時不因裁剪/隱藏被移除。
- 直營層永遠顯示（clusterer 處理密度）。

## 資訊卡（station-card）

點 marker（直營或加盟皆可）→ 底部卡片：
- 站名；加盟站加紅色「加盟站」徽章 + 「非直營，注意避免誤闖」說明。
- `isOpen === false` 時加灰色「暫停營業」徽章。
- 地址（完整含縣市鄉鎮）+ 複製鈕（navigator.clipboard，成功顯示 1.5s 提示）。
- 油品 chips：92/95/98/超級柴油，無供應者灰階。
- 「Google Maps 導航」：開新分頁 `https://www.google.com/maps/dir/?api=1&destination={lat},{lng}`。
- 關閉：卡片 X、點地圖空白處。

## 錯誤處理

- 無 API key / Maps 載入失敗：地圖區顯示錯誤卡（不 crash 整個 app），清單/油價分頁不受影響。
- 定位 timeout 10s → 視同拒絕（taiwan fallback），可再點「定位」鈕重試。
