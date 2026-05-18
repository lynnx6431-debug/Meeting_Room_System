const path = require('path');
const puppeteer = require('puppeteer-core');

const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const baseUrl = 'http://127.0.0.1:4174';
const outputDir = 'd:/Workspace/Meeting_Room_System_Architecture_V3/guest-kiosk';
const token = 'cmp5b6uhx00095dlgraqtkdt9';

async function clickByText(page, selector, text) {
  await page.evaluate(({ selector, text }) => {
    const nodes = Array.from(document.querySelectorAll(selector));
    const node = nodes.find((item) => item.textContent && item.textContent.includes(text));
    if (!node) {
      throw new Error('Node not found: ' + text);
    }
    node.click();
  }, { selector, text });
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    defaultViewport: { width: 1280, height: 900 },
    args: ['--no-sandbox'],
  });

  const page = await browser.newPage();
  await page.goto(`${baseUrl}/?token=${token}`, { waitUntil: 'networkidle0' });

  const inHeadcount = await page.evaluate(() => document.body.innerText.includes('HEADCOUNT'));
  if (inHeadcount) {
    await clickByText(page, 'button', '6');
    await clickByText(page, 'button', 'CONFIRM');
  }

  await page.waitForFunction(() => document.body.innerText.includes('YOUR SELECTION'));
  await clickByText(page, 'button', 'Back to home');
  await page.waitForFunction(() => document.body.innerText.includes('SESSION ACTIVE') && document.body.innerText.includes('RETURN TO MENU'));
  await page.screenshot({ path: path.join(outputDir, 'e3-11-S-back-to-home.png'), fullPage: true });

  await clickByText(page, 'button', '繁');
  await page.waitForFunction(() => document.body.innerText.includes('會話進行中') && document.body.innerText.includes('返回菜單'));
  await page.screenshot({ path: path.join(outputDir, 'e3-11-T-back-to-home-tc.png'), fullPage: true });

  await browser.close();
  console.log('S/T ok');
})();
