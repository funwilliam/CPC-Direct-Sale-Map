import type { CurrentPriceFile, PriceHistoryFile } from '../../types/station.ts';
import { FUEL_LABELS } from '../../types/station.ts';
import { fmtLocal } from '../../lib/format.ts';
import PriceChart from './PriceChart.tsx';

interface Props {
  price: CurrentPriceFile | null;
  history: PriceHistoryFile | null;
}

/** 油價頁（spec/price.md）：牌價卡 → 走勢圖 → 調價表 → 來源 */
export default function PricePage({ price, history }: Props) {
  if (!price) return <p className="page-pad">油價資料載入中…</p>;

  const { current } = price;
  const entries = history?.entries ?? [];
  const prev = entries.length >= 2 ? entries[entries.length - 2] : null;

  const items = (['g92', 'g95', 'g98', 'diesel'] as const).map((k) => ({
    key: k,
    label: FUEL_LABELS[k],
    value: current[k],
    delta: prev ? +(current[k] - prev[k]).toFixed(1) : null,
  }));

  // 近期調價表（最近 10 次，新到舊）——兼作走勢圖的表格視圖
  const recent = [...entries].slice(-10).reverse();

  return (
    <div className="price-page page-pad">
      <h2>中油牌價</h2>
      <p className="price-date">{current.date} 起生效（元/公升）</p>
      <div className="price-grid">
        {items.map((it) => (
          <div key={it.key} className="price-card">
            <div className="price-label">{it.label}</div>
            <div className="price-value">{it.value.toFixed(1)}</div>
            {it.delta !== null && it.delta !== 0 && (
              <div className={`price-delta ${it.delta > 0 ? 'up' : 'down'}`}>
                {it.delta > 0 ? '▲' : '▼'} {Math.abs(it.delta).toFixed(1)}
              </div>
            )}
            {it.delta === 0 && <div className="price-delta flat">— 持平</div>}
          </div>
        ))}
      </div>

      {entries.length >= 2 && <PriceChart entries={entries} />}

      {recent.length > 0 && (
        <div className="recent-table-wrap">
          <h3>近期調價</h3>
          <table className="recent-table">
            <thead>
              <tr>
                <th>生效日</th>
                <th>92</th>
                <th>95</th>
                <th>98</th>
                <th>柴油</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((e) => (
                <tr key={e.date}>
                  <td>{e.date}</td>
                  <td>{e.g92.toFixed(1)}</td>
                  <td>{e.g95.toFixed(1)}</td>
                  <td>{e.g98.toFixed(1)}</td>
                  <td>{e.diesel.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="attribution attribution-left">
        資料更新於 {fmtLocal(price.generatedAt)}・每週一自動更新
        <br />
        資料來源：台灣中油／經濟部能源署／政府資料開放平臺
      </p>
    </div>
  );
}
