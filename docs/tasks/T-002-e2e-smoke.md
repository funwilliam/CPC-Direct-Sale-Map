# T-002 正式 E2E 冒煙套件

狀態: **done（2026-07-05）**
依據: docs/adr/008-e2e-harness.md、各 spec 驗收對照
範圍: tests/e2e/、playwright.config.ts、deploy.yml e2e job
做: 3 條冒煙（啟動→定位→搜尋選站→資訊卡；搜尋+篩選；油價頁），
    @playwright/test 打正式網址，deploy 成功後自動執行。
驗收: [x] deploy workflow e2e job 綠燈 [x] 三條測試涵蓋 spec 驗收對照
