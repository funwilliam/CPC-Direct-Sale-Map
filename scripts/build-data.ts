// 站點管線：抓 openData 主資料 + 爬官網直營白名單交叉驗證 → public/data/stations.json
import { mkdir, writeFile } from 'node:fs/promises';
import { fetchJson } from './lib/http.ts';
import { scrapeDirectStationCodes } from './lib/scrape.ts';
import { buildStationsFile, STATION_SOURCE } from './lib/transform.ts';

const OUT = 'public/data/stations.json';

async function main() {
  const [rawList, directCodes] = await Promise.all([
    fetchJson<unknown[]>(STATION_SOURCE),
    scrapeDirectStationCodes(),
  ]);
  console.log(`openData ${rawList.length} 站；官網直營白名單 ${directCodes.size} 站`);

  const file = buildStationsFile(rawList, directCodes, new Date().toISOString());

  await mkdir('public/data', { recursive: true });
  await writeFile(OUT, JSON.stringify(file));
  console.log(
    `✓ ${OUT}：直營 ${file.directCount}／加盟 ${file.franchiseCount}（交叉驗證通過）`
  );
}

main().catch((e) => {
  console.error('站點管線失敗：', e.message ?? e);
  process.exit(1);
});
