import { useEffect, useState } from 'react';
import { clearCachesAndReload, getLastSync, getSyncLog } from '../../lib/dataStore.ts';
import { readMapLoad } from '../../lib/usage.ts';
import { fmtLocal } from '../../lib/format.ts';

type Engine = 'raster' | 'vector';

function getEngine(): Engine {
  return localStorage.getItem('mapRender') === 'vector' ? 'vector' : 'raster'; // 預設點陣
}

/** 設定頁（spec/settings.md）：地圖引擎、資料管理、關於與版權、診斷 */
export default function SettingsPage() {
  const [engine, setEngine] = useState<Engine>(getEngine);
  const [clearing, setClearing] = useState(false);
  const [diag, setDiag] = useState<string[]>([]);

  const pickEngine = (e: Engine) => {
    if (e === engine) return;
    localStorage.setItem('mapRender', e);
    setEngine(e);
    location.reload(); // 地圖引擎需重建地圖實例
  };

  useEffect(() => {
    const render = (document.querySelector('.map-container') as HTMLElement | null)?.dataset.render;
    setDiag([
      `視窗：${window.innerWidth} × ${window.innerHeight}`,
      `可視高度：${Math.round(window.visualViewport?.height ?? 0)}`,
      `顯示模式：${window.matchMedia('(display-mode: standalone)').matches ? '獨立 App' : '瀏覽器'}`,
      `地圖渲染：${render === 'VECTOR' ? '向量' : render === 'RASTER' ? '點陣' : '未載入'}`,
    ]);
  }, []);

  const lastSync = getLastSync();
  const usage = readMapLoad();
  const log = getSyncLog();

  return (
    <div className="settings-page page-pad">
      <h2>設定</h2>

      <section className="set-group">
        <h3>地圖引擎</h3>
        <div className="seg" role="radiogroup" aria-label="地圖引擎">
          <button
            className={engine === 'raster' ? 'seg-on' : ''}
            onClick={() => pickEngine('raster')}
            role="radio"
            aria-checked={engine === 'raster'}
          >
            點陣
          </button>
          <button
            className={engine === 'vector' ? 'seg-on' : ''}
            onClick={() => pickEngine('vector')}
            role="radio"
            aria-checked={engine === 'vector'}
          >
            向量
          </button>
        </div>
        <p className="set-hint">
          點陣：滑動最流暢，縮放時短暫出現載入區塊。向量：縮放平滑無載入區塊，部分裝置滑動偶有頓挫。切換後將重新載入。
        </p>
      </section>

      <section className="set-group">
        <h3>資料</h3>
        <div className="set-row">
          <span>資料同步於</span>
          <b>{lastSync ? fmtLocal(lastSync) : '—'}</b>
        </div>
        <p className="set-hint">站點與油價每週一更新；新資料發布後，會在下次開啟時自動同步。</p>
        <button
          className="set-btn"
          disabled={clearing}
          onClick={() => {
            setClearing(true);
            void clearCachesAndReload();
          }}
        >
          {clearing ? '清除中…' : '清除快取並重新載入'}
        </button>
        <details className="set-details">
          <summary>更新紀錄</summary>
          {log.length === 0 ? (
            <p className="set-hint">尚無紀錄</p>
          ) : (
            <ul className="set-log">
              {log.map((e, i) => (
                <li key={i}>
                  <span>{fmtLocal(e.t)}</span>
                  {e.msg}
                </li>
              ))}
            </ul>
          )}
        </details>
      </section>

      <section className="set-group">
        <h3>關於</h3>
        <div className="set-row">
          <span>版本</span>
          <b>v{__APP_VERSION__}</b>
        </div>
        <div className="set-row">
          <span>建置時間</span>
          <b>{fmtLocal(__BUILD_TS__)}</b>
        </div>
        <div className="set-row">
          <span>本月地圖載入</span>
          <b>{usage.count} 次</b>
        </div>
        <p className="set-hint">資料來源：台灣中油／經濟部能源署／政府資料開放平臺</p>
      </section>

      <section className="set-group">
        <h3>版權聲明</h3>
        <p className="set-legal">
          © 2026 funwilliam，保留一切權利。
          <br />
          本軟體禁止商業使用；未經授權，禁止修改本程式碼後重新發布（替換 Google Maps API
          金鑰除外），並禁止以任何形式使用 AI 解析本程式碼。禁止以爬蟲、機器人或其他自動化程式存取本站頁面或資料端點（如需原始資料請向政府資料開放平臺取得）。允許自行部署，但必須完整保留本版權聲明與聯繫方式。
          <br />
          聯繫：44458534+funwilliam@users.noreply.github.com
        </p>
      </section>

      <details className="set-details">
        <summary>診斷資訊</summary>
        <ul className="set-log">
          {diag.map((d, i) => (
            <li key={i}>{d}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}
