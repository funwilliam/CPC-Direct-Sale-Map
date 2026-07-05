# ARCHITECTURE — 順路加油（L1）

> 上限 100 行｜僅隨 ADR 更新｜細節契約見 docs/spec/

## 系統形態

純靜態前端 PWA + CI 排程資料管線。**無後端伺服器。**

```
┌─ GitHub Actions (排程) ──────────────────────────┐
│ scripts/ 資料管線                                 │
│   getStationInfo ─┐                              │
│   service_search ─┴→ 驗證+join → public/data/    │
│   MainProdListPrice → 快照 → price_history 累積   │
│   （產出不合法 → fail，不 commit）                 │
└──────────────────┬───────────────────────────────┘
                   ↓ commit 靜態 JSON
┌─ GitHub Pages ───┴───────────────────────────────┐
│ Vite + React + TS PWA                            │
│   features/map ── map-adapter（Google Maps 實作） │
│   features/list ─ fuse.js 模糊搜尋                │
│   features/price ─ 牌價卡 + 走勢圖                │
│   lib/ 純函式（auto-fit、距離、篩選）              │
└──────────────────────────────────────────────────┘
```

## 技術棧（ADR-001）

Vite + React + TypeScript + vite-plugin-pwa｜地圖 Google Maps JS API（ADR-002）｜搜尋 fuse.js｜資料管線 Node + TypeScript + zod（ADR-003）。

## 模組邊界

| 模組 | 職責 | 禁止 |
|---|---|---|
| `scripts/` | 抓取、驗證、join、產出 `public/data/*.json` | 不 import `src/` |
| `scripts/schema/` | zod schema = 資料契約，前後共用 | — |
| `src/map-adapter/` | 地圖供應商抽象：`setStations`/`onMarkerClick`/`fitBounds`/`onViewportChange`/`setLayerVisibility` | 介面不得洩漏 Google Maps 型別 |
| `src/features/*` | UI 垂直切片（map/list/price/station-card） | 不直接呼叫 Google Maps API |
| `src/lib/` | 純函式，無 DOM/框架依賴 | — |

## 資料流

1. **站點**（每月）：openData `getStationInfo`（類別欄位：自營站/加盟站/漁船站）為主資料；爬 `service_search.aspx` 直營清單做**交叉驗證**（2026-07-04 實測 626/626 完全吻合）——不一致 → 管線 fail 並要求人工檢查。產出 `stations.json`（含 `isDirect` 旗標；漁船站排除）。
2. **油價**（每週）：`MainProdListPrice` → `current_price.json` + append 到 `price_history.json`（首次由 historyprice.aspx 回填）。
3. 所有產出 JSON 含 `generatedAt`，前端顯示資料新鮮度。

## PWA 策略

- App shell：precache（build hash 版本控制）。
- `data/*.json`：stale-while-revalidate（先渲染快取，背景更新後提示）。
- Google Maps 圖磚：不快取（ToS）；離線時地圖區顯示不可用提示，清單/油價頁正常。

## 防超量計費（Google Maps）

API key 限制 HTTP referrer（僅 Pages 網域）+ GCP 每日配額上限 + 預算警示。用量目標 < 免費額度（10,000 載入/月）50%。

## 品質守則

測試集中在契約邊界：管線 zod 驗證 + fixtures 快照 + 統計斷言；單元測試只測 `lib/` 純函式；Playwright 冒煙 3 條。文件分層與行數上限見 `docs/PRD.md` 與任務卡制度（docs/tasks/）。
