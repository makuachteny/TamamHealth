import { chromium } from 'playwright';
const shotDir = '/private/tmp/claude-501/-Users-makuachtenygatluak-Documents-Projects-TamamHealth/cad7dbb8-1c9b-40dd-809c-e43686236886/scratchpad';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 500 } });
await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('text=Clinical Officer', { timeout: 15000 });
await page.click('text=Clinical Officer');
await page.waitForTimeout(1000);
await page.click('button:has-text("Submit")');
await page.waitForURL('**/dashboard**', { timeout: 20000 });
await page.waitForTimeout(1500);
const skip = page.locator('button:has-text("Skip setup")');
if (await skip.count()) { await skip.click(); await page.waitForTimeout(800); }
await page.screenshot({ path: `${shotDir}/hdr-clinical2.png`, clip: { x: 0, y: 0, width: 1600, height: 200 } });
await browser.close();
