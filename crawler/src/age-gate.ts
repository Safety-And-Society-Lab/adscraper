import { Page } from 'puppeteer';

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
    let clicked = false;

    // Try known selectors with longer timeout
    for (const selector of commonAgeGateSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 2000 });
        await page.click(selector);
        clicked = true;
        return { status: 'age_gate_bypassed', notes: `Clicked selector: ${selector}` };
      } catch {
        // Ignore and try next selector
      }
    }

    // Fallback: keyword-based button or link text match
    clicked = await page.evaluate((keywords) => {
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
