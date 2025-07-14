import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs/promises';
import path from 'path';

puppeteer.use(StealthPlugin());

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const crawlListPath = './crawl_list.txt';
const resultsFile = './crawl_results.csv';

const commonAgeGateSelectors = [
  '#guest-warning-accept',
  '#iamover18Btn',
  '.buttonOver18',
  '.js-closeAgeModal',
  'button[aria-label*="enter"]',
  '[data-label="over18_enter"]'
];

const fallbackTextMatches = [
  'i am 18', 'i am over 18', 'enter',
  'yes', 'i agree', 'i’m 18', 'continue'
];

const restrictionKeywords = [
  'not available in your state',
  'restricted access',
  'not available in your location',
  'you are not allowed to access this content',
  'your region'
];

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  let urls;
  try {
    const content = await fs.readFile(crawlListPath, 'utf-8');
    urls = content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'));
  } catch (e) {
    console.error(`Failed to read ${crawlListPath}:`, e.message);
    process.exit(1);
  }

  const results = [];

  for (const [index, url] of urls.entries()) {
    console.log(`\n Visiting site ${index + 1}/${urls.length}: ${url}`);
    const page = await browser.newPage();

    let result = {
      url,
      status: '',
      notes: ''
    };

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

      let clicked = false;

      // Try known selectors
      for (const selector of commonAgeGateSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 3000 });
          await page.click(selector);
          clicked = true;
          result.status = 'age_gate_bypassed';
          console.log(`Clicked age gate button: ${selector}`);
          break;
        } catch {}
      }

      // Fallback text match
      if (!clicked) {
        clicked = await page.evaluate((keywords) => {
          const matches = (el) => {
            const text = el.innerText?.toLowerCase();
            return text && keywords.some(k => text.includes(k));
          };

          const elements = [...document.querySelectorAll('button, a')];
          const target = elements.find(matches);
          if (target) {
            target.click();
            return true;
          }
          return false;
        }, fallbackTextMatches);

        if (clicked) {
          result.status = 'age_gate_bypassed';
          console.log('Clicked fallback age gate element by text match.');
        }
      }

      // If no gate was clicked, check for restriction language
      if (!clicked) {
        const pageText = await page.evaluate(() => document.body.innerText.toLowerCase());
        const restriction = restrictionKeywords.find(kw => pageText.includes(kw));
        if (restriction) {
          result.status = 'restricted';
          result.notes = `Matched restriction text: "${restriction}"`;
          console.warn(`Page appears to restrict access: ${restriction}`);
        } else {
          result.status = 'no_age_gate_found';
          console.log('No age gate found; page appears accessible');
        }
      }

      await delay(2000);
    } catch (e) {
      console.warn(`⚠️ Error while processing ${url}:`, e.message);
      result.status = 'error';
      result.notes = e.message;
    } finally {
      await page.close();
      results.push(result);
    }
  }

  await browser.close();

  // Write results to CSV
  const header = 'URL,Status,Notes\n';
  const rows = results.map(r =>
    `"${r.url}","${r.status}","${r.notes.replace(/"/g, '""')}"`
  );
  const csv = header + rows.join('\n');

  try {
    await fs.writeFile(resultsFile, csv, 'utf-8');
    console.log(`\n Results written to ${resultsFile}`);
  } catch (e) {
    console.error('Failed to write results:', e.message);
  }
})();
