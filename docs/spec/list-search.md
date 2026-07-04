# SPEC — 清單頁（list-search）

> 上限 120 行｜依據 PRD F5｜2026-07-04 凍結

## 搜尋

- fuse.js 索引欄位：`name`、`county`、`town`、`address`（權重 name 2 > town 1.5 > 其他 1）。
- threshold 0.35、ignoreLocation；輸入即搜（debounce 150ms）。
- 空關鍵字：顯示全部站（直營在前，同組依縣市排序）。

## 篩選（src/lib/filter.ts 純函式）

`filterStations(stations, { fuels: Set<'g92'|'g95'|'g98'|'diesel'>, query })`

- 油品多選 = AND（勾 98+柴油 → 兩者皆供應的站）。
- 篩選與搜尋可組合；先 fuse 搜尋再套油品條件。

## 顯示

- 每列：站名、縣市+鄉鎮區、油品 chips、距離（有定位時，haversine，四捨五入 0.1km）。
- **加盟站一眼可辨**：整列淡灰底 + 紅色「加盟」徽章（PRD F5 核心要求）。
- 列點擊 → 開啟該站資訊卡（與地圖共用元件）。
- 結果 > 200 筆只渲染前 200 + 「共 N 筆，請縮小範圍」（避免長列表卡頓；不引入虛擬捲動依賴）。

## 驗收對照

- 搜「文山」→ 文山區各站出現。
- 勾 98 → 全部結果 fuels.g98 = true。
- 加盟站在結果中有明顯視覺區隔。
