import { describe, it, expect } from 'vitest';
import {
  haversineKm,
  planInitialView,
  MAX_RADIUS_KM,
  ZOOM_FLOOR,
  TAIWAN_BOUNDS,
} from '../../src/lib/geo.ts';
import { filterByFuels, defaultSort } from '../../src/lib/filter.ts';
import type { Station } from '../../src/types/station.ts';

function mkStation(partial: Partial<Station>): Station {
  return {
    id: 'X0000',
    name: '測試站',
    county: '台北市',
    town: '文山區',
    address: '台北市文山區測試路1號',
    phone: '',
    lat: 25.0,
    lng: 121.5,
    fuels: { g92: true, g95: true, g98: false, diesel: false },
    isDirect: true,
    hours: '00:00-24:00',
    isOpen: true,
    ...partial,
  };
}

describe('haversineKm', () => {
  it('台北車站→台中車站約 130-135 km', () => {
    const km = haversineKm({ lat: 25.0478, lng: 121.517 }, { lat: 24.1369, lng: 120.685 });
    expect(km).toBeGreaterThan(125);
    expect(km).toBeLessThan(140);
  });
  it('同點距離為 0', () => {
    expect(haversineKm({ lat: 25, lng: 121 }, { lat: 25, lng: 121 })).toBe(0);
  });
});

describe('planInitialView (spec/map.md §自動縮放)', () => {
  const user = { lat: 25.0, lng: 121.5 };

  it('無定位 → 台灣全島', () => {
    const plan = planInitialView(null, [mkStation({})]);
    expect(plan).toEqual({ kind: 'taiwan', bounds: TAIWAN_BOUNDS });
  });

  it('30km 內有直營站 → fit bounds 含 user 與該站', () => {
    const near = mkStation({ lat: 25.05, lng: 121.55 });
    const plan = planInitialView(user, [near]);
    if (plan.kind !== 'fit') throw new Error(`expected fit, got ${plan.kind}`);
    expect(plan.bounds.north).toBeGreaterThanOrEqual(near.lat);
    expect(plan.bounds.south).toBeLessThanOrEqual(user.lat);
    expect(plan.bounds.east).toBeGreaterThanOrEqual(near.lng);
    expect(plan.bounds.west).toBeLessThanOrEqual(user.lng);
  });

  it('30km 外 → far + zoom 下限', () => {
    // 台北使用者 vs 高雄站（>300km）
    const far = mkStation({ lat: 22.63, lng: 120.3 });
    const plan = planInitialView(user, [far]);
    expect(plan).toEqual({ kind: 'far', center: user, zoom: ZOOM_FLOOR });
  });

  it('半徑常數為 30km（PRD F1）', () => {
    expect(MAX_RADIUS_KM).toBe(30);
  });
});

describe('filterByFuels (spec/list-search.md §篩選)', () => {
  const a = mkStation({ id: 'A', fuels: { g92: true, g95: true, g98: true, diesel: true } });
  const b = mkStation({ id: 'B', fuels: { g92: true, g95: true, g98: false, diesel: true } });
  const c = mkStation({ id: 'C', fuels: { g92: true, g95: true, g98: true, diesel: false } });

  it('空集合 → 不過濾', () => {
    expect(filterByFuels([a, b, c], new Set())).toHaveLength(3);
  });

  it('多選為 AND：98+柴油 → 僅兩者皆供應', () => {
    const out = filterByFuels([a, b, c], new Set(['g98', 'diesel'] as const));
    expect(out.map((s) => s.id)).toEqual(['A']);
  });
});

describe('defaultSort', () => {
  it('直營在前', () => {
    const f = mkStation({ id: 'F', isDirect: false });
    const d = mkStation({ id: 'D', isDirect: true });
    expect(defaultSort([f, d]).map((s) => s.id)).toEqual(['D', 'F']);
  });
});
