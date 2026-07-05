# ADR-008 E2E 冒煙：@playwright/test 對線上站點後部署驗收

日期：2026-07-05｜狀態：已採納

## 背景

spec 規定 3 條 E2E 冒煙，但 API key 的 referrer 白名單不含 localhost/CI，
本地與 CI 內的地圖無法載入，E2E 一直只以拋棄式腳本手動執行。

## 決定

1. 新增 devDep **@playwright/test**（測試框架；playwright 函式庫已在用）。
2. E2E 打**正式部署網址**（referrer 允許、全功能可用），作為 deploy workflow
   的後置 job（部署成功 → 立刻對線上跑冒煙，紅了立刻知道壞版上線）。
3. 三條冒煙（spec 驗收對照）：啟動→定位視野→搜尋選站→資訊卡；搜尋+油品篩選；
   油價頁（牌價卡/走勢圖/調價表/新鮮度）。mock geolocation（台南中西區）。
4. vitest 限定 `tests/unit/`，Playwright 限定 `tests/e2e/`，互不誤抓。

## 後果

- E2E 驗的是「已上線」版本（部署後驗收，非部署前守門）——壞版會短暫上線，
  由 CI 紅燈+快速 revert 兜底；對本專案規模是正確取捨。
