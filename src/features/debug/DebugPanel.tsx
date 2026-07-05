import { useEffect, useState } from 'react';
import { readMapLoad, FREE_TIER_MONTHLY } from '../../lib/usage.ts';

/** epoch → 瀏覽器當地時區 YYYY-MM-DD HH:mm (UTC±N) */
function fmtLocal(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  const oh = Math.floor(Math.abs(off) / 60);
  const om = Math.abs(off) % 60;
  const tz = `UTC${sign}${oh}${om ? ':' + p(om) : ''}`;
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())} (${tz})`;
}

/** 診斷面板（連點同一 tab 7 下啟用）：回報實機尺寸與本機 Maps 載入估算 */
export default function DebugPanel() {
  const [lines, setLines] = useState<string[]>([]);

  useEffect(() => {
    const probe = document.createElement('div');
    probe.style.cssText =
      'position:fixed;bottom:0;height:env(safe-area-inset-bottom);width:0;pointer-events:none';
    document.body.appendChild(probe);

    const measure = () => {
      const sabBottom = getComputedStyle(probe).height;
      const bar = document.querySelector('.tab-bar')?.getBoundingClientRect();
      const labels = [...document.querySelectorAll('.tab-label')].map((s) =>
        Math.round(s.getBoundingClientRect().bottom)
      );
      const app = document.querySelector('.app')?.getBoundingClientRect();
      const standalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (navigator as { standalone?: boolean }).standalone === true;
      const usage = readMapLoad();
      setLines([
        `BUILD ${fmtLocal(__BUILD_TS__)}`,
        `standalone=${standalone}`,
        `Maps載入(本機 ${usage.month}): ${usage.count} / 免費 ${FREE_TIER_MONTHLY}`,
        `  ↑本裝置估算，非帳號總量（帳號級需後端查 Cloud Monitoring）`,
        `innerH=${window.innerHeight} visualVP=${Math.round(window.visualViewport?.height ?? 0)}`,
        `clientH=${document.documentElement.clientHeight}`,
        `safe-inset-bottom=${sabBottom}`,
        `app top=${Math.round(app?.top ?? 0)} bottom=${Math.round(app?.bottom ?? 0)}`,
        `tabBar top=${Math.round(bar?.top ?? 0)} bottom=${Math.round(bar?.bottom ?? 0)}`,
        `label bottoms=${labels.join(',')}`,
      ]);
    };
    measure();
    const id = setInterval(measure, 500);
    window.visualViewport?.addEventListener('resize', measure);
    window.addEventListener('resize', measure);
    return () => {
      clearInterval(id);
      window.visualViewport?.removeEventListener('resize', measure);
      window.removeEventListener('resize', measure);
      probe.remove();
    };
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        top: 'env(safe-area-inset-top)',
        left: 0,
        right: 0,
        zIndex: 9999,
        background: 'rgba(0,0,0,0.82)',
        color: '#0f0',
        font: '11px/1.4 monospace',
        padding: '6px 8px',
        pointerEvents: 'none',
        whiteSpace: 'pre-wrap',
      }}
    >
      {lines.join('\n')}
    </div>
  );
}
