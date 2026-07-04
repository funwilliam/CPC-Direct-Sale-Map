// Phase 0.1 原型：從中油官網查詢系統抓「直營加油站」清單
// 用途：交叉驗證 openData getStationInfo 的「類別」欄位（自營站）是否等同官網「直營加油站」
// 零依賴，node >= 18（內建 fetch）。用法：node scrape-direct-list.mjs <輸出路徑.json>

const BASE = 'https://vipmbr.cpc.com.tw/mbwebs/service_search.aspx';
const UA = 'Mozilla/5.0 (compatible; CPC-Direct-Sale-Map/0.1; +https://github.com/funwilliam/CPC-Direct-Sale-Map)';

function extractHidden(html, name) {
  const m = html.match(new RegExp(`id="${name}" value="([^"]*)"`));
  return m ? m[1] : '';
}

function decodeEntities(s) {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .trim();
}

// 從 GridView 表格抓出每列儲存格文字
function parseGridView(html, tableId) {
  const tableMatch = html.match(new RegExp(`<table[^>]*id="${tableId}"[\\s\\S]*?</table>`));
  if (!tableMatch) return null;
  const rows = [...tableMatch[0].matchAll(/<tr[\s\S]*?<\/tr>/g)].map((r) =>
    [...r[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((c) =>
      decodeEntities(c[1].replace(/<[^>]+>/g, ''))
    )
  );
  return rows;
}

async function main() {
  // 1) GET 取得 ASP.NET 表單狀態與 session cookie
  const getRes = await fetch(BASE, { headers: { 'User-Agent': UA } });
  const cookies = getRes.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');
  const page = await getRes.text();

  const form = new URLSearchParams({
    __EVENTTARGET: '',
    __EVENTARGUMENT: '',
    __LASTFOCUS: '',
    __VIEWSTATE: extractHidden(page, '__VIEWSTATE'),
    __VIEWSTATEGENERATOR: extractHidden(page, '__VIEWSTATEGENERATOR'),
    __EVENTVALIDATION: extractHidden(page, '__EVENTVALIDATION'),
    TypeGroup: 'rbGroup2', // 直營加油站
    ddlCity: '全部縣市',
    ddlSubCity: '全部鄉鎮區',
    tbKWQuery: '',
    btnQuery: '查   詢',
  });

  // 2) POST 查詢
  const postRes = await fetch(BASE, {
    method: 'POST',
    headers: {
      'User-Agent': UA,
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: cookies,
      Referer: BASE,
    },
    body: form.toString(),
  });
  const result = await postRes.text();

  // 3) 解析直營站 GridView（MyGridView1 = 直營）
  const rows = parseGridView(result, 'MyGridView1');
  if (!rows || rows.length < 2) {
    const dumpPath = new URL('./_last_response.html', import.meta.url);
    await (await import('node:fs/promises')).writeFile(dumpPath, result);
    console.error(`解析失敗：找不到 MyGridView1 或無資料列。回應已存至 ${dumpPath.pathname}`);
    process.exit(1);
  }

  const header = rows[0];
  const stations = rows.slice(1).map((cells) =>
    Object.fromEntries(header.map((h, i) => [h, cells[i] ?? '']))
  );

  const out = {
    generatedAt: new Date().toISOString(),
    source: BASE,
    filter: '直營加油站/全部縣市',
    header,
    count: stations.length,
    stations,
  };

  const outPath = process.argv[2] ?? 'direct-stations.json';
  await (await import('node:fs/promises')).writeFile(outPath, JSON.stringify(out, null, 2));
  console.log(`直營站 ${stations.length} 筆，欄位：${header.join(' | ')}`);
  console.log(`已輸出 ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
