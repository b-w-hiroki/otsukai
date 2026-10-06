import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { startHarness } from '../harness.mjs';

const t = await startHarness({ noAnimation: true });
const { url, page, errs } = t;
const check = t.check;

await page.goto(`${url}index.html`, { waitUntil: 'domcontentloaded' });
const brandLinks = page.locator('a[href="https://birdman-studio.com/"]');
check('landing page has header and footer brand links', await brandLinks.count() === 2);
for (const link of await brandLinks.all()) {
  const box = await link.boundingBox();
  check('brand link has a 44px tap target', box && box.height >= 44, box ? `${box.width}x${box.height}` : 'none');
  check('brand link opens safely in a new tab', await link.getAttribute('target') === '_blank' && (await link.getAttribute('rel') || '').includes('noopener'));
}
await page.locator('.bs-sw-btn').click();
check('existing sister app menu still shows three apps', await page.locator('.bs-sw-pop a').count() === 3);
await page.keyboard.press('Escape');
check('Escape still closes sister app menu', await page.locator('.bs-sw-pop').isHidden());
check('landing page has no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));

const appHtml = readFileSync(join(process.cwd(), 'app.html'), 'utf8');
check('settings keeps a separate brand site link', /href="https:\/\/birdman-studio\.com\/"[^>]*>🏠 birdman studio・ほかのアプリ<\/a>/.test(appHtml));

if (errs.length) t.check('page has no uncaught errors', false, errs.join('\n'));
await t.finish();
