# ADR-001 前端技術棧：Vite + React + TypeScript

日期：2026-07-04｜狀態：已採納

## 背景

PWA 專案由兩個 AI agent（Claude 主導、Codex 協作）實作，token 預算有限，需要最低協作錯誤率的技術棧。

## 選項

1. Vite + React + TS — 生態最大，AI agent 訓練語料最多，出錯率最低。
2. SvelteKit — bundle 更小，但語料較少、協作猜錯 API 的機率較高。
3. Vanilla TS — 無框架開銷，但 UI 狀態管理自造輪子，長期維護成本高。

## 決定

選項 1。配 vite-plugin-pwa（Workbox）做 PWA 殼；模糊搜尋用 fuse.js；不引入全域狀態庫（React 內建 state + context 足夠，日後有需要再開 ADR）。

## 後果

- bundle 稍大 → 以效能預算（首屏 JS < 200KB gzip）約束。
- 新增 npm 套件一律先開 ADR，防依賴膨脹。
