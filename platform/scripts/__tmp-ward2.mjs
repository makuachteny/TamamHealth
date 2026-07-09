import { chromium } from 'playwright';

const OUT_DIR = '/private/tmp/claude-501/-Users-makuachtenygatluak-Documents-Projects-TamamHealth/a325a3d9-144f-413c-bcc2-db3a7dd04d79/scratchpad';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1800, height: 1100 } });
page.on('dialog', dialog => dialog.accept());

await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);
await page.locator('button.tl-user', { hasText: 'Stella Keji Lemi' }).click({ timeout: 10000 });
await page.waitForTimeout(500);
await page.locator('button[type="submit"]').click();
await page.waitForURL(/dashboard/, { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(1500);
const skipBtn = page.locator('button:has-text("Skip setup")');
if (await skipBtn.isVisible().catch(() => false)) { await skipBtn.click({ force: true }); await page.waitForTimeout(800); }

await page.goto('http://localhost:3000/dashboard/nurse', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.ehr-worklist-panel', { timeout: 20000 }).catch(() => console.log('worklist panel did not appear'));
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT_DIR}/ward-full.png` });

// Measure the card vs the table row/head widths precisely.
const measurements = await page.evaluate(() => {
  const panel = document.querySelector('.ehr-worklist-panel');
  const table = document.querySelector('.ehr-worklist-table');
  const head = document.querySelector('.ehr-worklist-head');
  const row = document.querySelector('.ehr-worklist-row');
  const rect = (el) => el ? { width: el.getBoundingClientRect().width, left: el.getBoundingClientRect().left, right: el.getBoundingClientRect().right } : null;
  const styleOf = (el, props) => el ? Object.fromEntries(props.map(p => [p, getComputedStyle(el)[p]])) : null;
  return {
    panel: rect(panel),
    table: rect(table),
    head: rect(head),
    row: rect(row),
    headStyle: styleOf(head, ['width', 'minWidth', 'display', 'gridTemplateColumns']),
    rowStyle: styleOf(row, ['width', 'minWidth', 'display', 'gridTemplateColumns']),
    tableStyle: styleOf(table, ['width', 'overflowX']),
  };
});
console.log(JSON.stringify(measurements, null, 2));

await browser.close();
