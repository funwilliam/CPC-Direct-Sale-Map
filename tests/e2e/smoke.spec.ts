import { test, expect } from '@playwright/test';

// 3 條冒煙（spec/map.md、spec/list-search.md、spec/price.md 驗收對照）

test('啟動 → 定位視野 → 搜尋選站 → 資訊卡', async ({ page }) => {
  await page.goto('./');
  // 啟動幕出現後淡出，揭幕即定位後視野（非全台 zoom 7）
  await expect(page.locator('.map-splash')).toBeVisible();
  await page.locator('.map-splash').waitFor({ state: 'detached', timeout: 15_000 });
  await expect
    .poll(async () => parseFloat((await page.locator('.map-container').getAttribute('data-zoom')) ?? '0'))
    .toBeGreaterThan(10);
  // marker 已掛載
  await expect(page.locator('.mk').first()).toBeAttached({ timeout: 15_000 });
  // 由搜尋覆層選第一站 → 覆層關閉、資訊卡開啟、導航連結格式正確
  await page.locator('.search-fab').click();
  await page.locator('.search-results .row-main').first().click();
  await expect(page.locator('.search-overlay')).toHaveCount(0);
  await expect(page.locator('.station-card')).toBeVisible();
  await expect(page.locator('.station-card h2')).not.toBeEmpty();
  await expect(page.locator('.nav-btn')).toHaveAttribute(
    'href',
    /google\.com\/maps\/dir\/\?api=1&destination=[\d.]+,[\d.]+/
  );
});

test('搜尋「文山」+ 98 油品篩選', async ({ page }) => {
  await page.goto('./');
  await page.locator('.search-fab').click({ timeout: 30_000 });
  await page.fill('.search-bar input', '文山');
  const rows = page.locator('.search-results li:not(.search-empty)');
  await expect(rows.first()).toBeVisible();
  const before = await rows.count();
  await page.click('.search-sheet .filter-btn:has-text("98 無鉛")');
  await expect(rows.first()).toBeVisible();
  const after = await rows.count();
  expect(after).toBeGreaterThan(0);
  expect(after).toBeLessThanOrEqual(before);
  // 加盟站徽章存在（一眼可辨）
  await expect(page.locator('.search-results .badge-franchise').first()).toBeVisible();
});

test('油價頁：牌價卡 / 走勢圖 / 調價表 / 新鮮度', async ({ page }) => {
  await page.goto('./');
  await page.click('.tab-bar button:has-text("油價")');
  await expect(page.locator('.price-card')).toHaveCount(4);
  await expect(page.locator('.chart-block svg path')).toHaveCount(4); // 四油品 step 線
  await expect(page.locator('.recent-table tbody tr')).toHaveCount(10);
  await expect(page.locator('.attribution')).toContainText('資料更新於');
});
