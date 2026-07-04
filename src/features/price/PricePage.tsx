import type { CurrentPriceFile, PriceHistoryFile } from '../../types/station.ts';
import { FUEL_LABELS } from '../../types/station.ts';

interface Props {
  price: CurrentPriceFile | null;
  history: PriceHistoryFile | null;
}

/** 油價頁 Phase 1 版：當前牌價卡片。走勢圖為 Phase 2（PRD F6）。 */
export default function PricePage({ price, history }: Props) {
  if (!price) return <p className="page-pad">油價資料載入中…</p>;

  const { current } = price;
  const prev = history && history.entries.length >= 2
    ? history.entries[history.entries.length - 2]
    : null;

  const items = (['g92', 'g95', 'g98', 'diesel'] as const).map((k) => ({
    key: k,
    label: FUEL_LABELS[k],
    value: current[k],
    delta: prev ? +(current[k] - prev[k]).toFixed(1) : null,
  }));

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
      <p className="price-note">歷史走勢圖規劃於 Phase 2 推出（資料每週自動累積中，目前 {history?.entries.length ?? 0} 筆）。</p>
    </div>
  );
}
