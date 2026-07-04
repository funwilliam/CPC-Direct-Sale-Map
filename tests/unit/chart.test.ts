import { describe, it, expect } from 'vitest';
import { filterByMonths, niceTicks, stepPath, resolveLabelYs, timeTicks } from '../../src/lib/chart.ts';
import type { PriceEntry } from '../../src/types/station.ts';

function mkEntry(date: string, v = 30): PriceEntry {
  return { date, g92: v, g95: v + 1.5, g98: v + 3.5, diesel: v - 1 };
}

describe('filterByMonths', () => {
  const entries = [
    mkEntry('2024-01-01'),
    mkEntry('2025-06-01'),
    mkEntry('2026-05-01'),
    mkEntry('2026-06-29'),
  ];

  it('null = 全部', () => {
    expect(filterByMonths(entries, null)).toHaveLength(4);
  });

  it('3 個月只留最近兩筆', () => {
    expect(filterByMonths(entries, 3).map((e) => e.date)).toEqual(['2026-05-01', '2026-06-29']);
  });

  it('區間內不足 2 筆 → 至少回傳最後 2 筆（可畫線）', () => {
    const sparse = [mkEntry('2020-01-01'), mkEntry('2026-06-29')];
    expect(filterByMonths(sparse, 3)).toHaveLength(2);
  });
});

describe('niceTicks', () => {
  it('油價區間出整潔刻度', () => {
    const ticks = niceTicks(28.7, 34.2);
    expect(ticks.length).toBeGreaterThanOrEqual(3);
    expect(ticks.length).toBeLessThanOrEqual(6);
    for (const t of ticks) {
      expect(t).toBeGreaterThanOrEqual(28.7);
      expect(t).toBeLessThanOrEqual(34.2);
    }
  });
});

describe('stepPath', () => {
  it('step-after：先水平後垂直', () => {
    const d = stepPath([
      { x: 0, y: 10 },
      { x: 50, y: 20 },
    ]);
    expect(d).toBe('M0.0,10.0H50.0V20.0');
  });
});

describe('resolveLabelYs', () => {
  it('重疊標籤推開至最小間距，保持輸入順序', () => {
    const out = resolveLabelYs([100, 104, 30], 14);
    expect(out[2]).toBe(30); // 不受影響
    expect(out[1] - out[0]).toBeGreaterThanOrEqual(14); // 100/104 被推開
  });
});

describe('timeTicks', () => {
  it('長區間標年份', () => {
    const ticks = timeTicks(new Date(2003, 0, 9).getTime(), new Date(2026, 5, 29).getTime());
    expect(ticks.length).toBeLessThanOrEqual(8);
    expect(ticks.every(([, label]) => /^\d{4}$/.test(label))).toBe(true);
  });

  it('短區間標月份', () => {
    const ticks = timeTicks(new Date(2026, 3, 1).getTime(), new Date(2026, 5, 29).getTime());
    expect(ticks.some(([, label]) => label.includes('月'))).toBe(true);
  });
});
