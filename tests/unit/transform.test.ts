import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildStationsFile, toStation, toPriceEntry, mergeHistory } from '../../scripts/lib/transform.ts';
import { RawStationSchema } from '../../scripts/schema/station.ts';
import { parseHistoryTable } from '../../scripts/backfill-history.ts';
import { extractStationCode } from '../../scripts/lib/scrape.ts';
import { rocToIso } from '../../scripts/schema/price.ts';
import { z } from 'zod';

const stationsFixture = JSON.parse(readFileSync('tests/fixtures/stations.sample.json', 'utf8'));
const priceFixture = JSON.parse(readFileSync('tests/fixtures/price.sample.json', 'utf8'));
const historyHtml = readFileSync('tests/fixtures/historyprice.sample.html', 'utf8');

describe('toStation', () => {
  const raws = z.array(RawStationSchema).parse(stationsFixture);

  it('自營站 → isDirect: true，完整地址含縣市鄉鎮', () => {
    const s = toStation(raws[0])!;
    expect(s.isDirect).toBe(true);
    expect(s.address.startsWith(s.county)).toBe(true);
    expect(s.address).toContain(s.town);
  });

  it('加盟站 → isDirect: false', () => {
    const franchise = raws.find((r) => r.類別 === '加盟站')!;
    expect(toStation(franchise)!.isDirect).toBe(false);
  });

  it('漁船站排除（回傳 null）', () => {
    const fishing = raws.find((r) => r.類別 === '漁船站')!;
    expect(toStation(fishing)).toBeNull();
  });

  it('油品 0/1 轉 boolean', () => {
    const s = toStation(raws[0])!;
    expect(typeof s.fuels.g92).toBe('boolean');
    expect(typeof s.fuels.diesel).toBe('boolean');
  });
});

describe('buildStationsFile 交叉驗證', () => {
  it('直營集合不一致時 throw（防資料源語意變更）', () => {
    const wrongCodes = new Set(['D9999']);
    expect(() => buildStationsFile(stationsFixture, wrongCodes, new Date().toISOString())).toThrow(
      /交叉驗證失敗/
    );
  });
});

describe('toPriceEntry', () => {
  it('從真實牌價 JSON 取出四油品與 ISO 生效日', () => {
    const e = toPriceEntry(priceFixture);
    expect(e.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(e.g92).toBeGreaterThan(0);
    expect(e.g95).toBeGreaterThan(e.g92); // 95 恆貴於 92
    expect(e.g98).toBeGreaterThan(e.g95);
  });
});

describe('mergeHistory', () => {
  const a = { date: '2026-06-22', g92: 31.4, g95: 32.9, g98: 34.9, diesel: 30.3 };
  const b = { date: '2026-06-29', g92: 30.4, g95: 31.9, g98: 33.9, diesel: 29.5 };

  it('依日期排序且去重（同日覆蓋）', () => {
    const merged = mergeHistory([b, a], { ...a, g92: 99 });
    expect(merged.map((e) => e.date)).toEqual(['2026-06-22', '2026-06-29']);
    expect(merged[0].g92).toBe(99);
  });
});

describe('parseHistoryTable', () => {
  it('解析官網歷史表格（真實 HTML fixture）', () => {
    const entries = parseHistoryTable(historyHtml);
    expect(entries.length).toBeGreaterThanOrEqual(5);
    for (const e of entries) {
      expect(e.date).toMatch(/^20\d{2}-\d{2}-\d{2}$/);
      expect(e.g95).toBeGreaterThan(e.g92);
    }
  });
});

describe('工具函式', () => {
  it('rocToIso 民國轉西元', () => {
    expect(rocToIso('1150629')).toBe('2026-06-29');
  });
  it('extractStationCode 從官網站名儲存格取站代號', () => {
    expect(extractStationCode('大甲站\r\n D4145')).toBe('D4145');
    expect(extractStationCode('安順站\r\n D507X\r\n (修繕中)')).toBe('D507X');
    expect(extractStationCode('無代號')).toBeNull();
  });
});
