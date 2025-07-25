import { Page } from 'puppeteer';
import * as log from './util/log.js';

const commonAgeGateSelectors = [
  '#guest-warning-accept',
  '#iamover18Btn',
  '.buttonOver18',
  '#rtaAcceptButton',
  '.eighteen-plus-button',
  '.js-closeAgeModal',
  'button[data-testid="accept-all-cookie-button"]',
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
  'your region',
  'at least 18'
];

export async function detectAndBypassAgeGate(page: Page): Promise<{ status: string; notes: string }> {
  try {
    // First, try to find and click common age gate selectors
    const selectorResult = await page.evaluate((selectors) => {
      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        for (const element of elements) {
          if (!(element instanceof HTMLElement)) {
            continue;
          }
          if (!element.checkVisibility()) {
            continue;
          }
          console.log(`Found age gate using selector: ${selector}`);
          element.click();
          return { status: 'age_gate_bypassed', selector };
        }
      }
      return null;
    }, commonAgeGateSelectors);

    if (selectorResult) {
      log.verbose(`Bypassed age gate using selector: ${selectorResult.selector}`);
      return { status: 'age_gate_bypassed', notes: `Clicked selector: ${selectorResult.selector}` };
    }
    log.verbose('No common age gate selectors found, trying text matches.');


    // Fallback: keyword-based button or link text match
    let clickedElement = await page.evaluate((keywords) => {
      const elements = [...document.querySelectorAll('button, a, [class*=btn], [class*=button]')] as HTMLElement[];

      const target = elements
         // Filter to visible elements
        .filter(element => element.checkVisibility())
        // Find element that matches a keyword
        .find(el => {
          const text = el.innerText?.toLowerCase();
          if (!text) return false;
          return keywords.some(keyword => {
            // Replace any special keyword characters with regex escape sequences
            const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            // Do a regex match to ensure matches are done on whole words (word boundaries)
            const regex = new RegExp(`\\b${escaped}\\b`, 'i');
            return regex.test(text);
          });
      });
      if (target) {
        target.click();
        return target.innerText;
      }
      return null;
    }, fallbackTextMatches);

    if (clickedElement) {
      log.verbose(`Clicked fallback element by text match: "${clickedElement}"`);
      return { status: 'age_gate_bypassed', notes: 'Clicked fallback element by text match' };
    }

    // Check for restriction content in the page body
    const pageText = await page.evaluate(() => document.body.innerText.toLowerCase());
    const restriction = restrictionKeywords.find(kw => pageText.includes(kw));
    if (restriction) {
      return { status: 'restricted', notes: `Matched restriction text: "${restriction}"` };
    }

    return { status: 'no_age_gate_found', notes: 'No age gate or restriction detected' };

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`Age gate detection error: ${msg}`);
    return { status: 'error', notes: `Error: ${msg}` };
  }
}
