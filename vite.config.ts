import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages 專案站點路徑
export default defineConfig({
  base: '/CPC-Direct-Sale-Map/',
  define: {
    // build 時間（epoch ms）：診斷面板以「瀏覽器當地時區」格式化顯示
    __BUILD_TS__: Date.now(),
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
        // data JSON 採 stale-while-revalidate（ARCHITECTURE §PWA 策略）
        runtimeCaching: [
          {
            urlPattern: /\/data\/.*\.json$/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'data-json' },
          },
        ],
      },
    }),
  ],
});
