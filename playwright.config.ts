import { defineConfig, devices } from '@playwright/test';

// E2E 打正式部署網址（API key referrer 僅允許正式網域，見 ADR-008）
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  retries: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'https://funwilliam.github.io/CPC-Direct-Sale-Map/',
    ...devices['iPhone 14'],
    // Playwright 的 iPhone preset 用 WebKit；改用 chromium 跑行動視口（CI 穩定）
    browserName: 'chromium',
    geolocation: { latitude: 22.9908, longitude: 120.2133 }, // 台南中西區
    permissions: ['geolocation'],
    locale: 'zh-TW',
  },
});
