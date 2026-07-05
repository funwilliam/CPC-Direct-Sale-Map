# SPEC — 設定頁（settings）

> 上限 120 行｜依據 PRD F7 v1.3、ADR-009｜2026-07-05 凍結

## 版面（卡片群組，沿用 design tokens）

1. **地圖引擎**：segmented control（點陣｜向量），預設點陣；切換寫入
   `localStorage.mapRender` 並重載（地圖實例需重建）。附一句取捨說明。
2. **資料**：資料同步於（當地時區格式）、說明文字、「清除快取並重新載入」
   按鈕（清全部 CacheStorage → reload）、更新紀錄（`<details>` 收合，
   最近 20 筆，來自 ADR-009 syncLog）。
3. **關於**：版本（package.json version）、建置時間（當地時區）、本月地圖
   載入次數（本機計數，不顯示額度與估算字樣）、資料來源一句。
4. **版權聲明**：LICENSE 摘要全文顯示 + 聯繫信箱
   （44458534+funwilliam@users.noreply.github.com）。
5. **診斷資訊**：`<details>` 收合——視窗尺寸、可視高度、顯示模式、
   地圖渲染（向量/點陣，讀 `.map-container` data-render）。中文標籤。

## 行為

- 取代原 debug 連點手勢（已移除）。
- 引擎預設：`mapRender` 未設或非 'vector' → 點陣（DEMO_MAP_ID）；
  'vector' → 正式向量 Map ID。

## 驗收

- [ ] 切換引擎後重載，診斷資訊「地圖渲染」隨之改變。
- [ ] 清除快取後重載會重新下載資料並寫入紀錄。
- [ ] 版本/建置時間/載入次數正確顯示，時間為當地時區格式。
