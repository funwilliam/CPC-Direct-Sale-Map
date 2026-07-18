import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import ErrorBoundary from './ErrorBoundary.tsx';
import './index.css';

// 部署換版後，開著的舊頁面載入延遲分頁 chunk 會 404（PWA autoUpdate 已清舊快取）。
// 自動重載一次拿新版本，免使用者手動處理；60 秒內只重載一次防迴圈。
window.addEventListener('vite:preloadError', (e) => {
  e.preventDefault();
  const KEY = 'chunkReloadAt';
  let last = 0;
  try {
    last = Number(sessionStorage.getItem(KEY) ?? 0);
  } catch {
    /* ignore */
  }
  if (Date.now() - last > 60_000) {
    try {
      sessionStorage.setItem(KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    location.reload();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
