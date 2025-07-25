import { Page } from "puppeteer";
import * as log from '../util/log.js';
import generalCookieSelectors from './easylist_cookie_general_hide.json' with { type: "json" };
import specificCookieSelectors from './easylist_cookie_specific_hide.json' with { type: "json" };
import { c } from "tar";

export async function removeCookieBanners(page: Page) {
  log.info(`${page.url()}: Attempting to remove cookie banners`);

  // Merge general and specific selectors
  // Look up specific selectors for the current domain
  const domain = new URL(page.url()).hostname.replace(/^www\./, '');
  // Identify keys matching the current domain
  const domainKey = Object.keys(specificCookieSelectors).filter(key => {
    const regex = new RegExp(key.replace(/\./g, '\\.').replace(/\*/g, '.*'));
    return regex.test(domain);
  });
  // Merge the specific selectors with the general selectors
  let cookieSelectors = Array.from(generalCookieSelectors);
  if (domainKey.length > 0) {
    const specificSelectors = specificCookieSelectors[domainKey[0] as keyof typeof specificCookieSelectors];
    if (specificSelectors && Array.isArray(specificSelectors)) {
      log.verbose(`Found ${specificSelectors.length} specific cookie selectors for domain: ${domain}`);
      cookieSelectors.push(...specificSelectors);
    }
  }

  let foundBanners = await page.evaluate((selectors: string[]) => {
    try {
      // Execute all of the input query selectors and collect results in a set.
      let cookieBanners = new Set<Element>();
      let matchingSelectors: string[] = [];
      selectors.forEach((selector) => {
        let matches = document.querySelectorAll(selector);
        matches.forEach((match) => {
          cookieBanners.add(match);
        });
        if (matches.length > 0) {
          matchingSelectors.push(selector);
        }
      });
      // Delete each matching element
      for (let banner of cookieBanners) {
        banner.remove();
      }
      return matchingSelectors;

    } catch (e) {
      throw e;
    }
  }, cookieSelectors);

  log.verbose(`Found ${foundBanners.length} cookie banners using selectors: ${foundBanners.join(', ')}`);
}
