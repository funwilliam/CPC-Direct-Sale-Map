// 由 SVG 母版精確點陣化各規格 icon（無縮放模糊）
// 用法：node scripts/gen-icons.mjs
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';

const svg = await readFile('public/icons/app-icon.svg', 'utf8');
const targets = [
  { file: 'public/icons/icon-512.png', size: 512 },
  { file: 'public/icons/icon-192.png', size: 192 },
  { file: 'public/apple-touch-icon.png', size: 180 }, // iOS 主畫面（iOS 自行套圓角）
];

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const t of targets) {
  await page.setViewportSize({ width: t.size, height: t.size });
  await page.setContent(
    `<!doctype html><style>*{margin:0}svg{display:block;width:${t.size}px;height:${t.size}px}</style>${svg}`
  );
  await page.screenshot({ path: t.file, clip: { x: 0, y: 0, width: t.size, height: t.size } });
  console.log(`✓ ${t.file} (${t.size}x${t.size})`);
}
await browser.close();
