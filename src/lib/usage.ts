// 本機 Google Maps 載入計數（設定頁顯示）。每次 new Map() 累加，按月歸零。
const KEY = 'mapLoads';

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

/** 讀取本月地圖載入計數（不累加） */
export function readMapLoad(): MonthCount {
  return read();
}
