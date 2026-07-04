import { z } from 'zod';
import {
  RawStationSchema,
  StationSchema,
  StationsFileSchema,
  type RawStation,
  type Station,
  type StationsFile,
} from '../schema/station.ts';
import {
  RawPriceSchema,
  PriceEntrySchema,
  type PriceEntry,
  rocToIso,
} from '../schema/price.ts';

const STATION_SOURCE = 'https://vipmbr.cpc.com.tw/openData/getStationInfo';
const PRICE_SOURCE = 'https://vipmbr.cpc.com.tw/openData/MainProdListPrice';

/** 原始站點 → 前端格式；漁船站回傳 null（排除） */
export function toStation(raw: RawStation): Station | null {
  if (raw.類別 === '漁船站') return null;
  return StationSchema.parse({
    id: raw.站代號.trim(),
    name: raw.站名.trim(),
    county: raw.縣市.trim(),
    town: raw.鄉鎮區.trim(),
    address: `${raw.縣市.trim()}${raw.鄉鎮區.trim()}${raw.地址.trim()}`,
    phone: raw.電話.trim(),
    lat: raw.緯度,
    lng: raw.經度,
    fuels: {
      g92: raw.無鉛92 === 1,
      g95: raw.無鉛95 === 1,
      g98: raw.無鉛98 === 1,
      diesel: raw.超柴 === 1,
    },
    isDirect: raw.類別 === '自營站',
    hours: raw.營業時間.trim(),
    isOpen: raw.營業中.trim() === '1',
  });
}

/**
 * 主資料 + 直營白名單交叉驗證 → stations.json 內容。
 * 兩來源的直營站代號集合不一致時 throw（ADR-003：fail 不 commit）。
 */
export function buildStationsFile(
  rawList: unknown[],
  directCodes: Set<string>,
  generatedAt: string
): StationsFile {
  const raws = z.array(RawStationSchema).parse(rawList);
  const stations = raws.map(toStation).filter((s): s is Station => s !== null);

  const openDataDirect = new Set(stations.filter((s) => s.isDirect).map((s) => s.id));
  const onlyOpenData = [...openDataDirect].filter((c) => !directCodes.has(c));
  const onlyScraped = [...directCodes].filter((c) => !openDataDirect.has(c));
  if (onlyOpenData.length > 0 || onlyScraped.length > 0) {
    throw new Error(
      `直營站交叉驗證失敗：僅 openData 有 ${onlyOpenData.length} 站 [${onlyOpenData.join(',')}]；` +
        `僅官網有 ${onlyScraped.length} 站 [${onlyScraped.join(',')}]。請人工檢查資料源語意是否變更。`
    );
  }

  const ids = new Set(stations.map((s) => s.id));
  if (ids.size !== stations.length) throw new Error('站代號重複');

  return StationsFileSchema.parse({
    generatedAt,
    source: STATION_SOURCE,
    directCount: openDataDirect.size,
    franchiseCount: stations.length - openDataDirect.size,
    stations,
  });
}

/** 汽柴油零售牌價 → 單一 PriceEntry；缺任一油品或生效日不一致時 throw */
export function toPriceEntry(rawList: unknown[]): PriceEntry {
  const raws = z.array(RawPriceSchema).parse(rawList);
  const retail = raws.filter((r) => r.型別名稱 === '汽柴油零售');
  const pick = (name: string) => {
    const row = retail.find((r) => r.產品名稱 === name);
    if (!row) throw new Error(`牌價資料缺少「${name}」`);
    return row;
  };
  const rows = {
    g92: pick('92無鉛汽油'),
    g95: pick('95無鉛汽油'),
    g98: pick('98無鉛汽油'),
    diesel: pick('超級柴油'),
  };
  const dates = new Set(Object.values(rows).map((r) => r.牌價生效日期.trim()));
  if (dates.size !== 1) throw new Error(`四油品生效日期不一致: ${[...dates].join(',')}`);

  return PriceEntrySchema.parse({
    date: rocToIso(rows.g92.牌價生效日期),
    g92: rows.g92.參考牌價_金額,
    g95: rows.g95.參考牌價_金額,
    g98: rows.g98.參考牌價_金額,
    diesel: rows.diesel.參考牌價_金額,
  });
}

/** 將新 entry 併入歷史（以 date 去重、覆蓋同日舊值、由舊到新排序） */
export function mergeHistory(entries: PriceEntry[], next: PriceEntry): PriceEntry[] {
  const byDate = new Map(entries.map((e) => [e.date, e]));
  byDate.set(next.date, next);
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export { STATION_SOURCE, PRICE_SOURCE };
