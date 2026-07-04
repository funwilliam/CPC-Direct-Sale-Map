# SPEC — 油價頁（price）

> 上限 120 行｜依據 PRD F6、ADR-007｜2026-07-04 凍結

## 版面（上→下）

1. 當前牌價四卡（既有，含對上次調價漲跌幅）。
2. **歷史走勢圖**（本期新增）。
3. 近期調價表（最近 10 次，日期 + 四油品，tabular-nums）——兼作圖表的無障礙表格視圖。
4. 資料來源標示。

## 走勢圖

- 形式：**step-after 折線**（牌價為階梯函數：生效日起維持到下次調價），單一 Y 軸（元/公升）。
- 資料：`price_history.json`（2003 起，~970 筆，全量渲染不抽樣）。
- 區間切換（chip 列，圖上方）：**3月 / 1年 / 5年 / 全部**，預設 1年。切換不得改變各油品顏色。
- 系列色（dataviz 已驗證，固定指派永不輪替）：
  92=`#2a78d6` 藍、95=`#1baf7a` 青、98=`#eda100` 黃、柴油=`#008300` 綠。
  aqua/yellow 對比 <3:1 → 依 relief 規則必附直接標籤與表格視圖。
- 線寬 2px；網格水平 hairline（`--line`）；軸文字 `--ink-3`；Y 軸 nice ticks 4-5 條；
  X 軸：區間 ≤ 13 個月標月份，否則標年份（≤ 6 個標籤）。
- **直接標籤**：右端每條線的油品名+現值（色點 + 文字用 ink 色），垂直防重疊（最小間距 14px）。
- **圖例**：圖下方一列（色點+名稱），四系列皆列。
- **互動**：pointer 追蹤 crosshair 垂直線 + tooltip（日期 + 四油品值，色點對應）；
  觸控可拖曳掃視；離開即隱藏。無 pan/zoom（區間 chip 取代）。
- 實作：手寫 SVG（ResizeObserver 量測寬度），無圖表庫依賴（ADR-007）。

## 純函式（src/lib/chart.ts，可測）

- `filterByMonths(entries, months | null)`：取最後 N 個月（null=全部）。
- `niceTicks(min, max, target)`：整潔刻度。
- `stepPath(points)`：step-after SVG path。
- `resolveLabelYs(desired[], minGap)`：直接標籤防重疊。

## 驗收

- [ ] 四區間切換皆正確渲染且顏色不變。
- [ ] tooltip 顯示正確日期與四值。
- [ ] 直接標籤無重疊（3月區間四值最接近時）。
- [ ] 手機寬 390px 無水平捲動。
- [ ] 通過 spec/design.md 門檻。
