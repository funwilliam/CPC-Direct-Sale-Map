// 歷史油價回填：解析中油官網 historyprice.aspx 表格（近 7 次調價）併入 price_history.json
// 完整 2003+ 歷史回填待能源署 oil111 系統恢復（見 docs/tasks/T-001.md）
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { fetchText } from './lib/http.ts';
import { mergeHistory } from './lib/transform.ts';
import { PriceHistoryFileSchema, PriceEntrySchema, type PriceEntry } from './schema/price.ts';

const SOURCE = 'https://www.cpc.com.tw/historyprice.aspx?n=2890';
const HISTORY_OUT = 'public/data/price_history.json';

/** 解析 tbHistoryPrice 表格列：民國日期 + 92/95/98/柴油 */
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
  const html = await fetchText(SOURCE);
  const parsed = parseHistoryTable(html);
  console.log(`官網歷史表格解析出 ${parsed.length} 筆調價`);

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
        source: `${SOURCE} + https://vipmbr.cpc.com.tw/openData/MainProdListPrice`,
        entries,
      })
    )
  );
  console.log(`✓ ${HISTORY_OUT}：共 ${entries.length} 筆（${entries[0].date} ~ ${entries[entries.length - 1].date}）`);
}

// 直接執行時才跑（供測試 import parseHistoryTable）
if (process.argv[1]?.endsWith('backfill-history.ts')) {
  main().catch((e) => {
    console.error('歷史回填失敗：', e.message ?? e);
    process.exit(1);
  });
}
