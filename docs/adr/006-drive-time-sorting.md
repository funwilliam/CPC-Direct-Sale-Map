# ADR-006 清單車程排序：Distance Matrix + 直線距離粗篩

日期：2026-07-04｜狀態：已採納（產品擁有者要求）

## 背景

清單頁應依「車程」排序（產品擁有者回饋），但 Google Distance Matrix 按元素計費，
全站計算（1,930 站）不可行。

## 決定

1. 兩階段：**haversine 直線距離粗篩**（30km 內、取最近 25 站 = 單請求上限）→
   一次 `DistanceMatrixService`（Maps JS API，同一把 key）取得行車分鐘數。
2. 快取：使用者位置量化到 ~300m 格網，`sessionStorage` 以「格網+站代號」存分鐘數；
   同 session 內重看清單零 API 呼叫。
3. 降級鏈：Distance Matrix 失敗（未啟用/超額）→ 直線距離排序；無定位 → 直營優先預設排序。
4. 顯示：有車程顯示「約 N 分鐘」，其餘顯示 km。

## 前置

產品擁有者需在 GCP 專案啟用 **Distance Matrix API**（同 key，免費額度 10,000 元素/月，
本設計每 session 最多 25 元素）。

## 後果

- 每位使用者每次開 app 最多 1 次 Distance Matrix 請求（25 元素），額度綽綽有餘。
- 排序在車程可用前先以直線距離呈現，體驗漸進增強。

> 修訂附註（2026-07-05）：省 API 再收緊——粗篩 30km→10km、單次查詢 25→10 站，
> 且改為「開啟搜尋覆層時」才查（現行值見 spec/list-search.md 與 src/lib/drivetime.ts）。
> 另加入無路線負快取（NO_ROUTE=-1）。ADR 本體不改，僅附註現況。
