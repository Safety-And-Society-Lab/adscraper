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
  'your region'
];

export async function detectAndBypassAgeGate(page: Page): Promise<{ status: string; notes: string }> {
  try {
    // First, try to find and click common age gate selectors
    try {
      let selectorResult = await Promise.any(commonAgeGateSelectors.map(async selector => {
        let handle = await page.waitForSelector(selector, { timeout: 2000 });
        if (!handle) {
          throw new Error('Element not found');
        }
        return {
          handle: handle,
          selector: selector
        };
      }));

      if (selectorResult) {
        await selectorResult.handle.click();
        return { status: 'age_gate_bypassed', notes: `Clicked selector: ${selectorResult.selector}` };
      }
    } catch (e: any) {
      // If no common selectors found, continue to fallback methods
      if (e instanceof AggregateError) {
        log.info(`No common age gate selectors found, trying fallback methods`);
      } else {
        throw e;  // Re-throw if the error is about something else
      }
    }

    // Fallback: keyword-based button or link text match
    let clicked = await page.evaluate((keywords) => {
      const elements = [...document.querySelectorAll('button, a')] as HTMLElement[];
      const target = elements.find(el => {
        const text = el.innerText?.toLowerCase();
        return text && keywords.some(k => text.includes(k));
      });
      if (target) {
        target.click();
        return true;
      }
      return false;
    }, fallbackTextMatches);

    if (clicked) {
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
