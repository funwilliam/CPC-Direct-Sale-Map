import { UA, fetchText } from './http.ts';

const SEARCH_URL = 'https://vipmbr.cpc.com.tw/mbwebs/service_search.aspx';

function extractHidden(html: string, name: string): string {
  const m = html.match(new RegExp(`id="${name}" value="([^"]*)"`));
  return m ? m[1] : '';
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .trim();
}

/** 從 GridView 表格取出每列儲存格純文字 */
export function parseGridView(html: string, tableId: string): string[][] | null {
  const tableMatch = html.match(new RegExp(`<table[^>]*id="${tableId}"[\\s\\S]*?</table>`));
  if (!tableMatch) return null;
  return [...tableMatch[0].matchAll(/<tr[\s\S]*?<\/tr>/g)].map((r) =>
    [...r[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((c) =>
      decodeEntities(c[1].replace(/<[^>]+>/g, ' '))
    )
  );
}

/** 官網查詢結果的站名儲存格 = 「站名 + 站代號 (+ 註記)」，取出站代號 */
export function extractStationCode(nameCell: string): string | null {
  const m = nameCell.match(/D[0-9A-Z]{4}/);
  return m ? m[0] : null;
}

/** 爬中油官網查詢系統「直營加油站」清單，回傳站代號集合 */
export async function scrapeDirectStationCodes(): Promise<Set<string>> {
  const getRes = await fetch(SEARCH_URL, { headers: { 'User-Agent': UA } });
  if (!getRes.ok) throw new Error(`HTTP ${getRes.status} ${SEARCH_URL}`);
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

  const html = await fetchText(SEARCH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: cookies,
      Referer: SEARCH_URL,
    },
    body: form.toString(),
  });

  // MyGridView1 = 直營站結果表
  const rows = parseGridView(html, 'MyGridView1');
  if (!rows || rows.length < 2) throw new Error('直營站查詢結果解析失敗：找不到 MyGridView1');

  const header = rows[0];
  const nameIdx = header.findIndex((h) => h.includes('站名'));
  if (nameIdx < 0) throw new Error(`直營站表頭找不到「站名」欄：${header.join('|')}`);

  const codes = new Set<string>();
  for (const cells of rows.slice(1)) {
    const code = extractStationCode(cells[nameIdx] ?? '');
    if (code) codes.add(code);
  }
  if (codes.size === 0) throw new Error('直營站清單為空');
  return codes;
}
