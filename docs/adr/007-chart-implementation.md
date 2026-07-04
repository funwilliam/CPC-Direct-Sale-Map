# ADR-007 走勢圖實作：手寫 SVG，不引入圖表庫

日期：2026-07-04｜狀態：已採納

## 背景

Phase 2 需要油價歷史走勢圖（4 系列、~970 點、區間切換、crosshair tooltip）。
候選：recharts（~100KB）、uPlot（~40KB）、lightweight-charts（~45KB）、手寫 SVG。

## 決定

**手寫 SVG 元件**（PriceChart，~250 行 + 純函式庫）：

- 需求面：4 條 step 折線 + 刻度 + tooltip，遠低於圖表庫的能力面積；970 點 SVG 直渲無效能問題。
- 依賴面：零新依賴（效能預算與 ADR 流程皆免），design tokens 直接套用。
- 幾何/刻度/標籤防重疊抽成 `src/lib/chart.ts` 純函式，可單元測試。
- 互動限定 crosshair + 區間 chip；若未來需要 pan/zoom（股價級操作）再開新 ADR 評估
  lightweight-charts。

## 後果

- tooltip/觸控細節自行維護（~60 行）。
- 系列色採 dataviz 驗證調色盤，寫死於 PriceChart 常數（色彩隨油品實體固定）。
