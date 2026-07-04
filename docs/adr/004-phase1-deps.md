# ADR-004 Phase 1 依賴：maps loader / markerclusterer / fuse.js

日期：2026-07-04｜狀態：已採納

## 背景

Phase 1 MVP 需要：載入 Google Maps JS、~2000 站 marker 聚合、清單頁模糊搜尋。
依 COLLABORATION 規範，新增 npm 套件需 ADR。

## 決定

- `@googlemaps/js-api-loader`：官方動態載入器，只在地圖分頁掛載時載入 Maps JS（省額度與首屏）。
- `@googlemaps/markerclusterer`：官方聚合器，配 AdvancedMarker。
- `fuse.js`：輕量（~5KB gzip）模糊搜尋，無伺服器需求，符合純靜態架構。
- 地圖初始化用 `mapId: 'DEMO_MAP_ID'`（AdvancedMarker 必要；正式 Map ID 免費，
  後續由產品擁有者在 GCP 建立後替換，見 tasks backlog）。

## 後果

三套件皆為運行時依賴；bundle 影響納入效能預算監控（首屏 JS < 200KB gzip，
Maps JS 本體為外部載入不計入）。
