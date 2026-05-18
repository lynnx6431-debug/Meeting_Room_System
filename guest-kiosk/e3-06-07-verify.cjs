const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const baseUrl = 'http://127.0.0.1:5173';
const roomToken = '1d656f35-5ceb-4bfa-bb37-edf7c6ffd857';
const outputDir = 'd:/Workspace/Meeting_Room_System_Architecture_V3/guest-kiosk';

(async () => {
  const browser = await puppeteer.launch({ executablePath: chromePath, headless: true, defaultViewport: { width: 1280, height: 800 }, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const consoleMessages = [];
  const pageErrors = [];

  page.on('console', (msg) => consoleMessages.push({ type: msg.type(), text: msg.text() }));
  page.on('pageerror', (err) => pageErrors.push(String(err)));

  await page.goto(`${baseUrl}/?token=${roomToken}`, { waitUntil: 'networkidle0' });

  if (await page.evaluate(() => document.body.innerText.includes('HEADCOUNT'))) {
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const shortcut = buttons.find((button) => button.textContent && button.textContent.trim() === '6');
      if (!shortcut) throw new Error('Shortcut 6 not found');
      shortcut.click();
    });
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const confirm = buttons.find((button) => button.textContent && button.textContent.includes('CONFIRM'));
      if (!confirm) throw new Error('Confirm button not found');
      confirm.click();
    });
    await page.waitForFunction(() => document.body.innerText.includes('YOUR SELECTION'));
  }

  const clickCategory = async (name) => {
    await page.evaluate((target) => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const match = buttons.find((button) => button.textContent && button.textContent.includes(target));
      if (!match) throw new Error(`Category not found: ${target}`);
      match.click();
    }, name);
  };

  const clickCard = async (title) => {
    await page.evaluate((target) => {
      const cards = Array.from(document.querySelectorAll('main > div.grid > div'));
      const card = cards.find((node) => node.textContent && node.textContent.includes(target));
      if (!card) throw new Error(`Card not found: ${target}`);
      card.click();
    }, title);
  };

  const clickTap = async (title) => {
    await page.evaluate((target) => {
      const cards = Array.from(document.querySelectorAll('main > div.grid > div'));
      const card = cards.find((node) => node.textContent && node.textContent.includes(target));
      if (!card) throw new Error(`Card not found: ${target}`);
      const button = card.querySelector('button');
      if (!button) throw new Error('Tap button missing');
      button.click();
    }, title);
  };

  const clickPlus = async (title) => {
    await page.evaluate((target) => {
      const cards = Array.from(document.querySelectorAll('main > div.grid > div'));
      const card = cards.find((node) => node.textContent && node.textContent.includes(target));
      if (!card) throw new Error(`Card not found: ${target}`);
      const buttons = Array.from(card.querySelectorAll('button'));
      const plus = buttons[buttons.length - 1];
      if (!plus) throw new Error('Plus missing');
      plus.click();
    }, title);
  };

  await clickCategory('Tidy Up');
  await page.waitForFunction(() => document.body.innerText.includes('Basic Tidy'));
  await clickCard('Basic Tidy');
  await page.waitForFunction(() => document.body.innerText.includes('SELECTED'));
  await page.screenshot({ path: path.join(outputDir, 'e3-06-F-one-off-selected.png'), fullPage: true });

  await clickCard('Basic Tidy');
  await page.waitForFunction(() => document.body.innerText.includes('TAP TO ADD'));
  await page.screenshot({ path: path.join(outputDir, 'e3-06-G-one-off-deselected.png'), fullPage: true });

  await clickCategory('Drinks');
  await page.waitForFunction(() => document.body.innerText.includes('Coffee'));
  await clickTap('Coffee');
  await clickPlus('Coffee');
  await clickCategory('Tidy Up');
  await page.waitForFunction(() => document.body.innerText.includes('Basic Tidy'));
  await clickCard('Basic Tidy');
  await page.waitForFunction(() => document.body.innerText.includes('3 items') && document.body.innerText.includes('DRINKS') && document.body.innerText.includes('TIDY UP'));
  await page.screenshot({ path: path.join(outputDir, 'e3-06-H-cart-grouped.png'), fullPage: true });

  await page.evaluate(() => {
    const panels = Array.from(document.querySelectorAll('aside'));
    const cart = panels[panels.length - 1];
    const rows = Array.from(cart.querySelectorAll('div'));
    const row = rows.find((node) => node.textContent && node.textContent.includes('Coffee'));
    if (!row) throw new Error('Coffee row not found');
    const button = row.querySelector('button');
    if (!button) throw new Error('Coffee remove button not found');
    button.click();
  });
  await clickCategory('Drinks');
  await page.waitForFunction(() => document.body.innerText.includes('1 item') && document.body.innerText.includes('0/6 used') && !document.body.innerText.includes('×2'));
  await page.screenshot({ path: path.join(outputDir, 'e3-06-I-cart-remove-sync.png'), fullPage: true });

  await page.evaluate(() => {
    const panels = Array.from(document.querySelectorAll('aside'));
    const cart = panels[panels.length - 1];
    const buttons = Array.from(cart.querySelectorAll('button'));
    const submit = buttons.find((button) => button.textContent && button.textContent.includes('PLACE ORDER'));
    if (!submit) throw new Error('Place order button not found');
    submit.click();
  });

  await page.waitForFunction(() => document.body.innerText.includes('Order Placed'));
  await page.screenshot({ path: path.join(outputDir, 'e3-06-K-order-confirmation.png'), fullPage: true });

  const result = { console: consoleMessages, pageErrors };
  fs.writeFileSync(path.join(outputDir, 'e3-06-07-console-log.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})().catch((error) => { console.error(error); process.exit(1); });
