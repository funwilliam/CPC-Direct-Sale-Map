# T-001 完整歷史油價回填（2003 年起）

狀態: backlog（等外部系統恢復）
依據: docs/adr/003-data-pipeline.md
範圍: scripts/backfill-history.ts
做: 能源署油價系統 https://www2.moeaea.gov.tw/oil111/Gasoline/RetailPrice 提供 2003 年起
    汽柴油參考零售價 CSV 下載。該系統 2026-07-04 持續 HTTP 502。恢復後：下載 CSV →
    轉為 PriceEntry[] → mergeHistory 併入 price_history.json（一次性執行）。
不做: 不對 oil111 做常態依賴（僅一次性回填；每週資料仍走中油 openData）。
驗收: [ ] price_history.json 最舊 entry 早於 2005 年 [ ] 全部通過 PriceHistoryFileSchema
