// 歷史油價回填（一次性）：能源署 oil111「汽柴油參考零售價」JSON API（2003 年起，A 欄=中油）
// 備援：中油官網 historyprice.aspx 表格（近 7 次調價）
// 每週例行累積仍走 fetch-price.ts（中油 openData），此腳本僅在建庫/補洞時執行。
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { fetchText } from './lib/http.ts';
import { mergeHistory } from './lib/transform.ts';
import { PriceHistoryFileSchema, PriceEntrySchema, type PriceEntry } from './schema/price.ts';

const OIL111_URL = 'https://www2.moeaea.gov.tw/oil111/Gasoline/RetailPrice/load';
const CPC_URL = 'https://www.cpc.com.tw/historyprice.aspx?n=2890';
const HISTORY_OUT = 'public/data/price_history.json';

interface Oil111Row {
  Date: string; // "2026/06/29"
  A92: number | null;
  A95: number | null;
  A98: number | null;
  Achai: number | null;
}

/** oil111 汽柴油參考零售價 API：multipart POST { start, end }（西元 yyyy/MM/dd） */
export async function fetchOil111History(start: string, end: string): Promise<PriceEntry[]> {
  const form = new FormData();
  form.append('start', start);
  form.append('end', end);
  const res = await fetch(OIL111_URL, { method: 'POST', body: form });
  if (!res.ok) throw new Error(`oil111 HTTP ${res.status}`);
  const json = (await res.json()) as { res: string; data?: { gasoline?: Oil111Row[] } };
  if (json.res !== '01' || !json.data?.gasoline) throw new Error(`oil111 回應異常: res=${json.res}`);

  const entries: PriceEntry[] = [];
  let dropped = 0;
  for (const r of json.data.gasoline) {
    if (r.A92 == null || r.A95 == null || r.A98 == null || r.Achai == null) {
      dropped++;
      continue;
    }
    entries.push(
      PriceEntrySchema.parse({
        date: r.Date.replaceAll('/', '-'),
        g92: r.A92,
        g95: r.A95,
        g98: r.A98,
        diesel: r.Achai,
      })
    );
  }
  if (dropped > 0) console.warn(`oil111 有 ${dropped} 筆缺值已略過`);
  return entries;
}

/** 備援：解析中油官網 tbHistoryPrice 表格（近 7 次調價） */
export function parseHistoryTable(html: string): PriceEntry[] {
  const tableMatch = html.match(/<table[^>]*id="tbHistoryPrice"[\s\S]*?<\/table>/);
  if (!tableMatch) throw new Error('找不到 tbHistoryPrice 表格');
  const rows = [...tableMatch[0].matchAll(/<tr>([\s\S]*?)<\/tr>/g)]
    .map((r) => [...r[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => c[1].replace(/<[^>]+>/g, '').trim()))
    .filter((cells) => cells.length === 5);
  if (rows.length === 0) throw new Error('tbHistoryPrice 無資料列');

  return rows.map((cells) => {
    const m = cells[0].match(/^(\d{2,3})\/(\d{2})\/(\d{2})$/);
    if (!m) throw new Error(`無法解析調價日期: "${cells[0]}"`);
    return PriceEntrySchema.parse({
      date: `${Number(m[1]) + 1911}-${m[2]}-${m[3]}`,
      g92: Number(cells[1]),
      g95: Number(cells[2]),
      g98: Number(cells[3]),
      diesel: Number(cells[4]),
    });
  });
}

async function main() {
  const today = new Date().toISOString().slice(0, 10).replaceAll('-', '/');
  let parsed: PriceEntry[];
  try {
    parsed = await fetchOil111History('2003/01/01', today);
    console.log(`oil111 取得 ${parsed.length} 筆（2003 起完整歷史）`);
  } catch (e) {
    console.warn(`oil111 失敗（${(e as Error).message}），退回中油官網近 7 週表格`);
    parsed = parseHistoryTable(await fetchText(CPC_URL));
  }

  let entries: PriceEntry[] = [];
  try {
    entries = PriceHistoryFileSchema.parse(JSON.parse(await readFile(HISTORY_OUT, 'utf8'))).entries;
  } catch {
    // 尚無歷史檔，從零開始
  }
  for (const e of parsed) entries = mergeHistory(entries, e);

  await mkdir('public/data', { recursive: true });
  await writeFile(
    HISTORY_OUT,
    JSON.stringify(
      PriceHistoryFileSchema.parse({
        generatedAt: new Date().toISOString(),
        source: `${OIL111_URL} + https://vipmbr.cpc.com.tw/openData/MainProdListPrice`,
        entries,
      })
    )
  );
  console.log(`✓ ${HISTORY_OUT}：共 ${entries.length} 筆（${entries[0].date} ~ ${entries[entries.length - 1].date}）`);
}

// 直接執行時才跑（供測試 import）
if (process.argv[1]?.endsWith('backfill-history.ts')) {
  main().catch((e) => {
    console.error('歷史回填失敗：', e.message ?? e);
    process.exit(1);
  });
}
