// 油價管線：抓當前牌價 → current_price.json + 快照 + 併入 price_history.json
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { fetchJson } from './lib/http.ts';
import { toPriceEntry, mergeHistory, PRICE_SOURCE } from './lib/transform.ts';
import { CurrentPriceFileSchema, PriceHistoryFileSchema } from './schema/price.ts';

const CURRENT_OUT = 'public/data/current_price.json';
const HISTORY_OUT = 'public/data/price_history.json';

async function main() {
  const rawList = await fetchJson<unknown[]>(PRICE_SOURCE);
  const entry = toPriceEntry(rawList);
  const generatedAt = new Date().toISOString();

  await mkdir('public/data', { recursive: true });
  await mkdir('data/snapshots', { recursive: true });

  // 原始快照（追溯用）
  await writeFile(
    `data/snapshots/${entry.date}.json`,
    JSON.stringify({ fetchedAt: generatedAt, raw: rawList }, null, 2)
  );

  await writeFile(
    CURRENT_OUT,
    JSON.stringify(CurrentPriceFileSchema.parse({ generatedAt, source: PRICE_SOURCE, current: entry }))
  );

  let entries = [entry];
  try {
    const prev = PriceHistoryFileSchema.parse(JSON.parse(await readFile(HISTORY_OUT, 'utf8')));
    entries = mergeHistory(prev.entries, entry);
  } catch {
    console.warn('無既有 price_history.json，從當前牌價起始（歷史回填見 data:backfill）');
  }
  await writeFile(
    HISTORY_OUT,
    JSON.stringify(PriceHistoryFileSchema.parse({ generatedAt, source: PRICE_SOURCE, entries }))
  );

  console.log(
    `✓ 牌價 ${entry.date}：92=${entry.g92} 95=${entry.g95} 98=${entry.g98} 柴=${entry.diesel}（歷史 ${entries.length} 筆）`
  );
}

main().catch((e) => {
  console.error('油價管線失敗：', e.message ?? e);
  process.exit(1);
});
