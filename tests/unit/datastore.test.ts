import { describe, it, expect } from 'vitest';
import { lastScheduledUpdate } from '../../src/lib/dataStore.ts';

// 排程：每週日 19:00 UTC（= 台灣週一 03:00，含 30 分部署緩衝）
describe('lastScheduledUpdate（ADR-009 對齊排程更新）', () => {
  it('週三查詢 → 回最近的週日 19:00 UTC', () => {
    // 2026-07-08 是週三
    const now = Date.UTC(2026, 6, 8, 10, 0, 0);
    expect(lastScheduledUpdate(now)).toBe(Date.UTC(2026, 6, 5, 19, 0, 0)); // 7/5 週日
  });

  it('週日 19:00 前 → 回上週日（本週排程未完成）', () => {
    const now = Date.UTC(2026, 6, 5, 18, 0, 0); // 週日 18:00 UTC
    expect(lastScheduledUpdate(now)).toBe(Date.UTC(2026, 5, 28, 19, 0, 0)); // 6/28
  });

  it('週日 19:00 後 → 回當日（新資料已部署）', () => {
    const now = Date.UTC(2026, 6, 5, 19, 30, 0);
    expect(lastScheduledUpdate(now)).toBe(Date.UTC(2026, 6, 5, 19, 0, 0));
  });

  it('同步於排程後 → 不需重抓；同步於排程前 → 需重抓', () => {
    const now = Date.UTC(2026, 6, 8, 10, 0, 0); // 週三
    const sched = lastScheduledUpdate(now);
    const syncedAfter = Date.UTC(2026, 6, 6, 3, 0, 0); // 週一凌晨同步過
    const syncedBefore = Date.UTC(2026, 6, 4, 12, 0, 0); // 上週六
    expect(syncedAfter >= sched).toBe(true);
    expect(syncedBefore >= sched).toBe(false);
  });
});
