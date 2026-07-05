# 專案總結報告 — 全面審查與稽核（2026-07-05/06）

> PM：Claude｜範圍：全專案（程式、管線、CI、文件、法務、UX）｜性質：資訊性報告，不屬 L0-L3 治理文件層

## 一、審計方法

7 個 subagent 並行：5 個審計面向（不同模型視角）＋ 2 條研究線（大師治理實踐蒸餾）。
所有發現由 PM 逐項覆核後才修，未確認的不修。

| 組 | 面向 | 發現數（採納/駁回） |
|---|---|---|
| A | 正確性（資料層、地圖、腳本） | 11 / 2 |
| B | 安全與法務 | 3 / 1 |
| C | 文件一致性（spec ↔ 實作漂移） | 8 / 0 |
| D | 資料管線與 CI 可靠性 | 7 / 1 |
| E | UX 與無障礙 | 12 / 3 |

## 二、關鍵修正（依風險排序）

1. **fetch-price 歷史覆寫風險（高危）**：原 catch 過寬——歷史檔讀取失敗（權限、瞬時 IO）會被當成「檔案不存在」而以單筆重建，**20 年 966 筆歷史可能一次排程被砍成 1 筆**。修正：僅 `ENOENT` 允許單筆起始，其他錯誤 throw 中止（管線 fail 不 commit）。
2. **排程靜默失效（Dead Man's Switch）**：GitHub 曾跳過週日 cron。修正三層：data-cron 雙排程（週日 18:30 UTC＋週一 06:30 備援）＋失敗自動開 issue；health.yml 每週二檢查線上 `generatedAt` 逾 9 天即開 issue；deploy 失敗原地重試＋告警 job。
3. **外部端點無逾時**：中油端點掛起會吊死排程。http.ts 加 30s timeout＋2 次退避重試（4xx 不重試）。
4. **油價邏輯斷言**：92<95<98、單價 [5,100] 區間，來源資料異常即中止不污染快照。
5. **非安全情境/隱私模式崩潰**：Cache API 不存在時 loadData 直接 fetch fallback；localStorage/sessionStorage 全部 try-catch。
6. **ErrorBoundary**：render 期例外不再白畫面。
7. **無障礙**：文字對比 2.5→6.0:1、全域 :focus-visible、觸控目標 ≥44px、覆層 dialog 語意＋Esc/遮罩關閉。
8. **文件漂移歸零**：spec/map.md 補上 setSelected/onMapClick/雙 Map ID/裁剪上限 80/zoom 13/暫停營業徽章；PRD 對齊 v1.3；ADR-004/005/006 以「修訂附註」記錄現況（ADR 本體永不改，符合 Nygard 慣例）。

驗證：`tsc` 通過、31/31 單元測試綠、build 綠（主 bundle 87KB gzip < 200KB 預算、非首屏分頁已 lazy 拆 chunk）、deploy＋線上 E2E 3 條全綠（run 28747562548）。

## 三、大師方法蒸餾 → 本專案對照

研究線覆蓋：Nygard/Fowler/ThoughtWorks（治理）、Böckeler（AI 自主極限）、Kent Beck、Simon Willison、Hashimoto、Ronacher、Harper Reed、Steinberger、Anthropic 官方實踐、METR/GitClear/DORA 實證研究。收斂出五條與實證一致的主軸：

1. **驗收迴路是唯一瓶頸**（Anthropic「give Claude a check it can run」、Willison「健全測試套件讓 agentic 工具飛起來」、DORA「AI 是放大器」）。本專案的對應物：zod schema＋統計斷言＋邏輯斷言（管線）、31 條單元測試（純函式）、3 條線上 E2E（部署後置 job）、dead man's switch（時間維度）。**每一層資料流都有機器可執行的 pass/fail。**
2. **監督不可省，感知不可信**（Böckeler「限制因素是人類驗證能力」；METR RCT：資深開發者用 AI 實測反慢 19% 但自以為快 20%）。本專案實踐：PM 覆核每個 subagent 發現、駁回 7 條誤報；iOS 白 bar 事件證明「盲猜迭代」比「查官方文件」貴一個數量級。
3. **流程重量與不確定性成比例**（Anthropic 反固定重流程；Steinberger 反 spec 派的存在證明 spec 不是萬能）。本專案文件分層（L0 150 行→L3 30 行）＋行數上限＝膨脹警報，正是「最小充分制度」：夠約束 AI 發散，不淪為 Zaninotto 批評的「瀑布回歸」（單功能 1300 行文字）。
4. **ADR 治失憶**（Nygard：immutable、supersede 用新檔；「過期的決策日誌比沒有更糟」）。本專案 9 篇 ADR 各 ≤40 行，本輪審計用「修訂附註」而非改本體，保持決策考古可信。
5. **AI 犯錯就寫進制度**（Hashimoto：錯一次就進 AGENTS.md；Beck：警惕 AI 刪測試作弊）。本專案對應：熔斷機制（返工 ≥2 次即停工修上層文件）＋memory 沉澱避坑要點。

## 四、避坑要點（可攜出本專案）

1. **catch 分類再降級**：只有「預期中的缺失」（如 ENOENT）才走初始化路徑，其他錯誤必須 fail loudly——否則累積資料會被靜默重置。
2. **累積資料先讀後寫、驗證舊檔再合併**；排程管線異常時「不 commit」優於「commit 空結果」。
3. **零後端 app 的每一份可增長資料都要上限＋回收**（syncLog 20 筆、driveTimes 12 格網 FIFO）。
4. **除錯先排除快取層**（SW/瀏覽器/CDN）：加 build 時間戳再開始猜，否則你在跟舊版本辯論。
5. **平台怪癖查官方文件而非試錯**（iOS safe-area、PS 5.1 BOM、GitHub cron 不保證觸發、Pages artifact 撞名）。
6. **「沒有錯誤 ≠ 有成功」**：排程類自動化一律配 dead man's switch。
7. **外部 API 假設全部要斷言**：欄位可靠性用全量下載驗證（本專案早期「類別欄位不可靠」是取樣偏差造成的誤判）。
8. **免費配額服務先設硬性阻斷再上線**（GCP 配額上限；使用者側待辦）。

## 五、剩餘風險與待辦

- **使用者側**：GCP 試用期解除後設配額阻斷（Maps loads 300/日、Distance Matrix elements 500/日）＋預算警示。
- **接受的風險**：中油端點無 SLA（已有 tolerant reader＋斷言＋告警，斷供時 app 靠快取續命）；Google Maps 計費模型變動（MapAdapter 抽象保留 MapLibre 退路，ADR-002）。
- **backlog**：下週油價預告（無官方 API）、oil111 深度回填。

## 六、結論

五面向審計發現已全數處置（41 採納、7 駁回），全部驗證綠。專案治理機制（文件分層、ADR、熔斷、管線斷言、dead man's switch、E2E 後置驗收）與 2024-26 業界大師實踐及實證研究的共識方向一致。可複製的通用方法已抽象為 3 個 skill（見 `~/.claude/skills/`）。
