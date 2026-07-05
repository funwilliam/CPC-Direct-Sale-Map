import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import pkg from './package.json';

// GitHub Pages 專案站點路徑
export default defineConfig({
  base: '/CPC-Direct-Sale-Map/',
  define: {
    // build 時間（epoch ms）與版本號：設定頁以「瀏覽器當地時區」格式化顯示
    __BUILD_TS__: Date.now(),
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  test: {
    include: ['tests/unit/**/*.test.ts'], // e2e 歸 Playwright（ADR-008）
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: '順路加油',
        short_name: '順路加油',
        description: '台灣中油直營加油站地圖',
        lang: 'zh-TW',
        theme_color: '#1a56db',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/CPC-Direct-Sale-Map/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // data JSON 完全交給 app 層 Cache API 管理（ADR-009：離線優先、對齊排程才更新），
        // 不進 SW precache（否則每次部署都會被動下載新資料）也不做 runtimeCaching
        globIgnores: ['**/data/*.json'],
        navigateFallbackDenylist: [/\/data\//],
      },
    }),
  ],
});
