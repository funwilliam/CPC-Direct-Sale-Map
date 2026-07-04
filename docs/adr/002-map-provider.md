# ADR-002 地圖：Google Maps JS API + MapAdapter 抽象層

日期：2026-07-04｜狀態：已採納（產品擁有者選定）

## 背景

需要內嵌互動地圖。2025/3 Google 改制後 Maps JS API 免費額度為每月 10,000 次載入（超過 $7/千次，需綁卡）；開源替代 MapLibre + OpenFreeMap 零費用但無 SLA。

## 決定

- 採 **Google Maps JS API**（產品擁有者確認可綁卡；預估用量 << 免費額度）。
- 所有地圖操作經 `src/map-adapter/` 抽象介面，**介面不洩漏 Google Maps 型別**，保留低成本切換 MapLibre 的退路。
- Marker 用 AdvancedMarker + @googlemaps/markerclusterer。
- 導航跳轉用 URL deep link（`google.com/maps/dir/?api=1&destination=lat,lng`），不耗 API 額度。

## 防超量措施（上線前必設）

API key HTTP referrer 限制 + GCP 每日配額上限 + 預算警示。

## 後果

- 需要產品擁有者建 GCP 專案取得 API key（Phase 1 地圖動工前）。
- 離線模式地圖不可用（圖磚不可快取，ToS 限制），已寫入 PRD 非目標。
