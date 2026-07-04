# ADR-003 資料管線：openData 為主 + 爬蟲交叉驗證

日期：2026-07-04｜狀態：已採納

## 背景

前期調查曾懷疑 openData `getStationInfo` 的「類別」欄位不可靠（取樣全是加盟站）。
2026-07-04 完整下載驗證（1972 站）：**自營站 626／加盟站 1313／漁船站 33**，且與官網
`service_search.aspx`「直營加油站」查詢結果（626 站）**站代號 100% 吻合**（0 差異，
見 scripts/prototype/scrape-direct-list.mjs）。

## 決定

1. **站點主資料 = openData `getStationInfo`**（類別=自營站 → `isDirect: true`；漁船站排除）。
2. **爬蟲降級為交叉驗證**：每次站點更新時同時爬官網直營清單，兩來源站代號集合不一致 → 管線 fail、不 commit、要求人工檢查（防中油悄悄改語意）。
3. 油價：每週抓 `MainProdListPrice` → `current_price.json` + append `price_history.json`；歷史一次性回填自 `cpc.com.tw/historyprice.aspx`。
4. 管線用 Node + TS + zod；統計斷言：站數在 [500, 800]（直營）、座標在台灣範圍 (21-27N, 118-123E)。
5. 排程：GitHub Actions——油價每週一 02:00 TST；站點每月 1 日。異常 fail 不 commit。

## 後果

- 不依賴脆弱的 HTML 爬蟲當主要來源，管線更穩。
- 交叉驗證需維護爬蟲，但它失效只會擋更新、不影響線上版本（靜態 JSON 仍在）。
