const path = require('path');
const puppeteer = require('puppeteer-core');

const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const baseUrl = 'http://127.0.0.1:4174';
const outputDir = 'd:/Workspace/Meeting_Room_System_Architecture_V3/guest-kiosk';
const token = 'cmp5b6uhx00095dlgraqtkdt9';

function hasMenu(body) {
  return (
    body.includes('YOUR SELECTION') ||
    body.includes('你的選擇') ||
    body.includes('你的选择')
  );
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    defaultViewport: { width: 380, height: 820 },
    args: ['--no-sandbox'],
  });

  const page = await browser.newPage();
  await page.goto(`${baseUrl}/?token=${token}`, { waitUntil: 'networkidle0' });

  const inHeadcount = await page.evaluate(() => document.body.innerText.includes('HEADCOUNT') || document.body.innerText.includes('用餐人數') || document.body.innerText.includes('用餐人数'));
  if (inHeadcount) {
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const six = buttons.find((btn) => btn.textContent && btn.textContent.trim() === '6');
      if (!six) throw new Error('6 not found');
      six.click();
    });
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const confirm = buttons.find((btn) => btn.textContent && (btn.textContent.includes('CONFIRM') || btn.textContent.includes('確認') || btn.textContent.includes('确认')));
      if (!confirm) throw new Error('confirm not found');
      confirm.click();
    });
  }

  await page.waitForFunction((hasMenuFnSource) => {
    const hasMenuFn = new Function('body', `return (${hasMenuFnSource})(body);`);
    return hasMenuFn(document.body.innerText);
  }, { timeout: 45000 }, hasMenu.toString());

  await page.screenshot({ path: path.join(outputDir, 'e3-11-U-mobile-380.png'), fullPage: true });

  await browser.close();
  console.log('U ok');
})();
