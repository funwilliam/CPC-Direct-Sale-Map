# SPEC — 視覺設計系統與驗收門檻

> 上限 120 行｜依據 PRD §5 成功標準（商業級美學）｜2026-07-04 凍結

## Design tokens（src/index.css :root，唯一真相）

| 類別 | Token | 值 |
|---|---|---|
| 品牌色 | `--brand` / `--brand-dark` / `--brand-tint` | #1a56db / #153e9e / #eaf1fe |
| 中性色 | `--bg` / `--surface` / `--line` | #f6f7f9 / #fff / #e8eaee |
| 文字 | `--ink` / `--ink-2` / `--ink-3` | #1b1f27 / #5b6472 / #9aa3b0 |
| 語意色 | `--red(-tint)` / `--green(-tint)` | #d92d20 / #067647（漲/跌、加盟/供應） |
| 圓角 | `--radius-s/m/l` | 8 / 12 / 20 px |
| 陰影 | `--shadow-1/2` | 浮起 / 懸浮（卡片、FAB） |
| 動效 | `--dur` / `--ease` | 180ms / cubic-bezier(.2,0,0,1) |

新色彩/圓角/陰影一律先加 token 再使用；hardcode 十六進位色值 = review 退回。

## 元件規範

- **無 header，邊到邊**（v1.2，產品擁有者要求）：地圖延伸到 iOS 狀態列下
  （black-translucent + viewport-fit=cover），頂部 14px+inset 深色漸層 scrim 保持時間可讀；
  非地圖分頁以品牌色 `status-strip`（高度 = safe-area-inset-top）填充。品牌識別由 PWA icon 承擔。
- **Tab bar**：icon（24px stroke 1.8 圓角端點）+ 標籤（0.7rem）；作用中 = 品牌色 + `--brand-tint` 圓角底；含 iOS safe-area padding。
- **FAB（定位鈕）**：48px 圓、白底、`--shadow-2`、右下角；按壓 scale(.92)。
- **使用者藍點**：18px 藍芯（#1a73e8）+ 3px 白圈 + 投影 + 呼吸光暈動畫（2.4s）。
- **資訊卡**：`--radius-l`、`--shadow-2`、進場位移動畫 180ms。
- **徽章**：tint 底 + 深色字（不用純色底白字小徽章）。

## 驗收門檻（每個 UI PR 逐項檢查，任一不過 = 退回）

- [ ] 間距對齊 4pt 網格；同層級元素間距一致。
- [ ] 觸控目標 ≥ 44×44px。
- [ ] 文字對比 ≥ 4.5:1（小字）/ 3:1（粗大字）。
- [ ] 只使用 tokens（色彩/圓角/陰影/動效不 hardcode）。
- [ ] 動效 120–250ms、有 easing；不使用 linear 位移。
- [ ] icon 同一風格（24px stroke 圓端點），不混用 emoji/實心/異寬。
- [ ] iOS safe-area（`env(safe-area-inset-*)`）處理。
- [ ] 空狀態/載入/錯誤三態皆有設計，不裸露技術訊息。
- [ ] 截圖比對：與主流商業 app（Google Maps 等）並排看不突兀。

## 明確不做

深色模式（backlog）、自訂字型檔（用系統 Noto Sans TC fallback 鏈）、動畫庫依賴。
