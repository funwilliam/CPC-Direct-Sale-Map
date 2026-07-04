import { useEffect, useMemo, useRef, useState } from 'react';
import { filterByMonths, niceTicks, resolveLabelYs, stepPath, timeTicks } from '../../lib/chart.ts';
import type { PriceEntry } from '../../types/station.ts';

// 系列色：dataviz 驗證調色盤，隨油品實體固定、永不輪替（spec/price.md）
const SERIES = [
  { key: 'g92', label: '92', color: '#2a78d6' },
  { key: 'g95', label: '95', color: '#1baf7a' },
  { key: 'g98', label: '98', color: '#eda100' },
  { key: 'diesel', label: '柴油', color: '#008300' },
] as const;

const RANGES = [
  { label: '3月', months: 3 },
  { label: '1年', months: 12 },
  { label: '5年', months: 60 },
  { label: '全部', months: null },
] as const;

const H = 260;
const PAD = { top: 12, right: 78, bottom: 26, left: 34 };

interface Props {
  entries: PriceEntry[]; // 依 date 升冪
}

export default function PriceChart({ entries }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [months, setMonths] = useState<number | null>(12);
  const [hover, setHover] = useState<number | null>(null); // 資料索引

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const data = useMemo(() => filterByMonths(entries, months), [entries, months]);

  const geom = useMemo(() => {
    if (width === 0 || data.length < 2) return null;
    const xs = data.map((e) => new Date(e.date).getTime());
    const x0 = xs[0];
    const x1 = xs[xs.length - 1];
    const values = data.flatMap((e) => SERIES.map((s) => e[s.key]));
    const vMin = Math.min(...values);
    const vMax = Math.max(...values);
    const padV = Math.max((vMax - vMin) * 0.08, 0.5);
    const yMin = vMin - padV;
    const yMax = vMax + padV;
    const plotW = width - PAD.left - PAD.right;
    const plotH = H - PAD.top - PAD.bottom;
    const toX = (ms: number) => PAD.left + ((ms - x0) / Math.max(x1 - x0, 1)) * plotW;
    const toY = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin)) * plotH;
    return { xs, x0, x1, yMin, yMax, toX, toY, plotW, plotH };
  }, [width, data]);

  if (entries.length < 2) return null;

  const labelYs = geom
    ? resolveLabelYs(SERIES.map((s) => geom.toY(data[data.length - 1][s.key])))
    : [];

  const onMove = (clientX: number) => {
    if (!geom || !wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const px = clientX - rect.left;
    // 找最近資料點（xs 已升冪）
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < geom.xs.length; i++) {
      const d = Math.abs(geom.toX(geom.xs[i]) - px);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    setHover(best);
  };

  const hoverEntry = hover !== null ? data[hover] : null;
  const hoverX = hoverEntry && geom ? geom.toX(new Date(hoverEntry.date).getTime()) : 0;
  // tooltip 靠左或靠右避免出界
  const tipLeft = geom && hoverX > PAD.left + geom.plotW * 0.55;

  return (
    <div className="chart-block">
      <div className="chart-head">
        <h3>歷史走勢</h3>
        <div className="range-chips" role="group" aria-label="時間區間">
          {RANGES.map((r) => (
            <button
              key={r.label}
              className={`filter-btn ${months === r.months ? 'filter-on' : ''}`}
              onClick={() => {
                setMonths(r.months);
                setHover(null);
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <div
        ref={wrapRef}
        className="chart-wrap"
        onPointerMove={(e) => onMove(e.clientX)}
        onPointerDown={(e) => onMove(e.clientX)}
        onPointerLeave={() => setHover(null)}
      >
        {geom && (
          <svg width={width} height={H} role="img" aria-label="油價歷史走勢圖（下方附調價表）">
            {/* 水平網格 + Y 刻度 */}
            {niceTicks(geom.yMin, geom.yMax).map((t) => (
              <g key={t}>
                <line
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={geom.toY(t)}
                  y2={geom.toY(t)}
                  className="grid-line"
                />
                <text x={PAD.left - 6} y={geom.toY(t) + 3.5} className="axis-text" textAnchor="end">
                  {t}
                </text>
              </g>
            ))}
            {/* X 刻度 */}
            {timeTicks(geom.x0, geom.x1).map(([ms, label]) => (
              <text key={ms} x={geom.toX(ms)} y={H - 8} className="axis-text" textAnchor="middle">
                {label}
              </text>
            ))}
            {/* 系列（step-after） */}
            {SERIES.map((s) => (
              <path
                key={s.key}
                d={stepPath(
                  data.map((e) => ({ x: geom.toX(new Date(e.date).getTime()), y: geom.toY(e[s.key]) }))
                )}
                fill="none"
                stroke={s.color}
                strokeWidth="2"
                strokeLinejoin="round"
              />
            ))}
            {/* 右端直接標籤（relief 規則：文字用 ink，色點帶身分） */}
            {SERIES.map((s, i) => (
              <g key={s.key}>
                <circle cx={width - PAD.right + 10} cy={labelYs[i]} r="4" fill={s.color} />
                <text x={width - PAD.right + 18} y={labelYs[i] + 3.5} className="label-text">
                  {s.label} {data[data.length - 1][s.key].toFixed(1)}
                </text>
              </g>
            ))}
            {/* crosshair */}
            {hoverEntry && (
              <g>
                <line x1={hoverX} x2={hoverX} y1={PAD.top} y2={H - PAD.bottom} className="crosshair" />
                {SERIES.map((s) => (
                  <circle
                    key={s.key}
                    cx={hoverX}
                    cy={geom.toY(hoverEntry[s.key])}
                    r="4"
                    fill={s.color}
                    stroke="#fff"
                    strokeWidth="2"
                  />
                ))}
              </g>
            )}
          </svg>
        )}
        {hoverEntry && (
          <div
            className="chart-tooltip"
            style={tipLeft ? { right: width - hoverX + 10 } : { left: hoverX + 10 }}
          >
            <div className="tip-date">{hoverEntry.date}</div>
            {SERIES.map((s) => (
              <div key={s.key} className="tip-row">
                <span className="tip-dot" style={{ background: s.color }} />
                {s.label === '柴油' ? '柴油' : `${s.label} 無鉛`}
                <b>{hoverEntry[s.key].toFixed(1)}</b>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="chart-legend">
        {SERIES.map((s) => (
          <span key={s.key} className="legend-item">
            <span className="tip-dot" style={{ background: s.color }} />
            {s.label === '柴油' ? '超級柴油' : `${s.label} 無鉛`}
          </span>
        ))}
      </div>
    </div>
  );
}
