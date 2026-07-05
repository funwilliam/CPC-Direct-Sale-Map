// 走勢圖純函式（spec/price.md §純函式）
import type { PriceEntry } from '../types/station.ts';

/** 取最後 N 個月的資料（null = 全部）；至少保留 2 筆才能畫線 */
export function filterByMonths(entries: PriceEntry[], months: number | null): PriceEntry[] {
  if (months === null || entries.length === 0) return entries;
  // 全程 UTC 計算（"YYYY-MM-DD" 以 UTC 解析，混用 local getter 在負時區會偏一日）
  const cutoff = new Date(entries[entries.length - 1].date);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - months);
  const iso = cutoff.toISOString().slice(0, 10);
  const out = entries.filter((e) => e.date >= iso);
  return out.length >= 2 ? out : entries.slice(-2);
}

/** 整潔 Y 軸刻度（1/2/2.5/5 × 10^n 步長） */
export function niceTicks(min: number, max: number, target = 4): number[] {
  if (min === max) return [min];
  const span = max - min;
  const rawStep = span / target;
  const mag = 10 ** Math.floor(Math.log10(rawStep));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= target + 0.5) ?? 10 * mag;
  const start = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + 1e-9; v += step) ticks.push(Math.round(v * 100) / 100);
  return ticks;
}

export interface Pt {
  x: number;
  y: number;
}

/** step-after 路徑（牌價為階梯函數） */
export function stepPath(pts: Pt[]): string {
  if (pts.length === 0) return '';
  let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    d += `H${pts[i].x.toFixed(1)}V${pts[i].y.toFixed(1)}`;
  }
  return d;
}

/** 直接標籤防重疊：依期望 y 排序後往下推開至最小間距，回傳與輸入同序的結果 */
export function resolveLabelYs(desired: number[], minGap = 14): number[] {
  const order = desired.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y);
  for (let k = 1; k < order.length; k++) {
    if (order[k].y - order[k - 1].y < minGap) order[k].y = order[k - 1].y + minGap;
  }
  const out = new Array<number>(desired.length);
  for (const { y, i } of order) out[i] = y;
  return out;
}

/** X 軸刻度：短區間標月、長區間標年，最多 maxTicks 個。回傳 [timestamp, label] */
export function timeTicks(startMs: number, endMs: number, maxTicks = 6): [number, string][] {
  const spanDays = (endMs - startMs) / 86_400_000;
  const ticks: [number, string][] = [];
  if (spanDays <= 400) {
    const stepMonths = spanDays <= 100 ? 1 : spanDays <= 200 ? 2 : 3;
    const d = new Date(startMs);
    d.setDate(1);
    d.setMonth(d.getMonth() + 1); // 從下一個月初開始
    while (d.getTime() <= endMs) {
      ticks.push([d.getTime(), `${d.getMonth() === 0 ? `${d.getFullYear()}/` : ''}${d.getMonth() + 1}月`]);
      d.setMonth(d.getMonth() + stepMonths);
    }
  } else {
    const startYear = new Date(startMs).getFullYear() + 1;
    const endYear = new Date(endMs).getFullYear();
    const stepYears = Math.max(1, Math.ceil((endYear - startYear + 1) / maxTicks));
    for (let y = startYear; y <= endYear; y += stepYears) {
      ticks.push([new Date(y, 0, 1).getTime(), String(y)]);
    }
  }
  return ticks.slice(0, maxTicks);
}
