const path = require('path');
const puppeteer = require('puppeteer-core');

const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const baseUrl = 'http://127.0.0.1:4174';
const outputDir = 'd:/Workspace/Meeting_Room_System_Architecture_V3/guest-kiosk';
const token = '1d656f35-5ceb-4bfa-bb37-edf7c6ffd857';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    defaultViewport: { width: 1280, height: 900 },
    args: ['--no-sandbox'],
  });

  const page = await browser.newPage();
  await page.goto(`${baseUrl}/order-confirmation?token=${token}`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => document.body.innerText.includes('ORDER MORE') || document.body.innerText.includes('繼續訂購') || document.body.innerText.includes('继续点餐'));
  await page.screenshot({ path: path.join(outputDir, 'e3-11-V-confirmation-language-toggle.png'), fullPage: true });
  await browser.close();
  console.log('V ok');
})();
