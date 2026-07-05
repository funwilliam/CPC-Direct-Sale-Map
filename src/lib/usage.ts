// 本機 Google Maps 載入計數（診斷用估算）。
// 註：Google Maps JS API 不提供前端查詢帳號級用量的方法，帳號總量需後端 + Cloud
// Monitoring API。此處以「本裝置每月地圖載入次數」估算，每次 new Map() ≈ 一次計費
// Dynamic Maps load。僅反映本機、非帳號總量。免費額度為每月每帳號 10,000 次。
const KEY = 'mapLoads';
export const FREE_TIER_MONTHLY = 10_000;

interface MonthCount {
  month: string; // YYYY-MM
  count: number;
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function read(): MonthCount {
  const month = currentMonth();
  try {
    const prev = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<MonthCount>;
    if (prev.month === month && typeof prev.count === 'number') return { month, count: prev.count };
  } catch {
    /* ignore */
  }
  return { month, count: 0 };
}

/** 地圖載入時累加，回傳本月最新計數 */
export function bumpMapLoad(): MonthCount {
  const next = read();
  next.count += 1;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore（隱私模式等） */
  }
  return next;
}

/** 讀取本月本機地圖載入計數（不累加） */
export function readMapLoad(): MonthCount {
  return read();
}
