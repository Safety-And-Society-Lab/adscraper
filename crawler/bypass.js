import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


const browser = await puppeteer.launch({ headless: false, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const page = await browser.newPage();

await page.goto('https://e621.net');
await page.waitForSelector('#guest-warning-accept');
await page.click('#guest-warning-accept');

await delay(2000);

console.log('Age gate passed');