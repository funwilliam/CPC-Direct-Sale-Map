import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages 專案站點路徑
export default defineConfig({
  base: '/CPC-Direct-Sale-Map/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: '順路油站',
        short_name: '順路油站',
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
