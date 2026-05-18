const path = require('path');
const puppeteer = require('puppeteer-core');

const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const baseUrl = 'http://127.0.0.1:4174';
const outputDir = 'd:/Workspace/Meeting_Room_System_Architecture_V3/guest-kiosk';
const token = 'cmp5b86tt0006bkml9a0ksfj6';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    defaultViewport: { width: 1280, height: 900 },
    args: ['--no-sandbox'],
  });

  const page = await browser.newPage();
  await page.goto(`${baseUrl}/?token=${token}`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => document.body.innerText.includes('All categories have reached') || document.body.innerText.includes('所有類別') || document.body.innerText.includes('所有类别'));
  await page.screenshot({ path: path.join(outputDir, 'e3-11-R-all-categories-full.png'), fullPage: true });
  await browser.close();
  console.log('R ok');
})();
