import { useEffect, useState } from 'react';

const DISMISS_KEY = 'installPromptDismissed';
const SHOW_DELAY_MS = 4000; // 不跟首屏地圖搶注意力

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as { standalone?: boolean }).standalone === true
  );
}

function isIOS(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent);
}

/**
 * PWA 安裝引導（不強制、可關閉、關閉後不再出現）：
 * - Chrome/Edge/Android：beforeinstallprompt → 一鍵安裝。
 * - iOS Safari：無安裝 API → 顯示「分享 → 加入主畫面」指引。
 */
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [mode, setMode] = useState<'hidden' | 'native' | 'ios'>('hidden');

  useEffect(() => {
    if (isStandalone() || localStorage.getItem(DISMISS_KEY)) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      timer = setTimeout(() => setMode('native'), SHOW_DELAY_MS);
    };
    window.addEventListener('beforeinstallprompt', onBip);

    if (isIOS()) {
      timer = setTimeout(() => setMode('ios'), SHOW_DELAY_MS);
    }
    return () => {
      window.removeEventListener('beforeinstallprompt', onBip);
      if (timer) clearTimeout(timer);
    };
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setMode('hidden');
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === 'dismissed') localStorage.setItem(DISMISS_KEY, '1');
    setMode('hidden');
  };

  if (mode === 'hidden') return null;

  return (
    <div className="install-banner" role="dialog" aria-label="安裝 App">
      <span className="logo-mark install-logo" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 21s-7-5.1-7-11a7 7 0 1 1 14 0c0 5.9-7 11-7 11Z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
      </span>
      <div className="install-text">
        {mode === 'native' ? (
          <>
            <b>安裝「順路加油」</b>
            <span>加到主畫面，像 App 一樣使用</span>
          </>
        ) : (
          <>
            <b>加入主畫面體驗更好</b>
            <span>
              點瀏覽器
              <svg className="ios-share-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label="分享">
                <path d="M12 3v12M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
              </svg>
              分享鈕 → 「加入主畫面」
            </span>
          </>
        )}
      </div>
      {mode === 'native' && (
        <button className="install-btn" onClick={install}>
          安裝
        </button>
      )}
      <button className="install-close" onClick={dismiss} aria-label="關閉">
        ×
      </button>
    </div>
  );
}
