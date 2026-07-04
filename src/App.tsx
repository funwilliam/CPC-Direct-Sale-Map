import { useEffect, useState } from 'react';

interface DataStatus {
  directCount: number;
  franchiseCount: number;
  priceDate: string;
  g95: number;
  generatedAt: string;
}

/** Phase 0 骨架頁：驗證部署與資料載入端到端可用。Phase 1 換成地圖主頁。 */
export default function App() {
  const [status, setStatus] = useState<DataStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const base = import.meta.env.BASE_URL;
    Promise.all([
      fetch(`${base}data/stations.json`).then((r) => r.json()),
      fetch(`${base}data/current_price.json`).then((r) => r.json()),
    ])
      .then(([stations, price]) =>
        setStatus({
          directCount: stations.directCount,
          franchiseCount: stations.franchiseCount,
          priceDate: price.current.date,
          g95: price.current.g95,
          generatedAt: stations.generatedAt,
        })
      )
      .catch((e) => setError(String(e)));
  }, []);

  return (
    <main className="shell">
      <h1>順路油站</h1>
      <p className="tagline">台灣中油直營加油站地圖（建置中）</p>
      {error && <p className="error">資料載入失敗：{error}</p>}
      {status ? (
        <dl className="stats">
          <div>
            <dt>直營站</dt>
            <dd>{status.directCount}</dd>
          </div>
          <div>
            <dt>加盟站</dt>
            <dd>{status.franchiseCount}</dd>
          </div>
          <div>
            <dt>95 無鉛（{status.priceDate} 起）</dt>
            <dd>{status.g95} 元/公升</dd>
          </div>
        </dl>
      ) : (
        !error && <p>載入資料中…</p>
      )}
      <footer>
        資料來源：台灣中油股份有限公司／政府資料開放平臺（非官方應用）
      </footer>
    </main>
  );
}
