import { ElementHandle, JSHandle, Page } from 'puppeteer';
import adSelectors from './easylist_ad_selectors.json' with { type: "json" };
import specificAdSelectors from './easylist_ad_specific_selectors.json' with { type: "json" };
import * as log from '../util/log.js';

/**
 * Detects ads in the page using EasyList's CSS selectors, and returns an
 * array of element handles corresponding to ads.
 * This function also deduplicates any identical elements, or elements nested
 * inside each other.
 */
export async function identifyAdsInDOM(page: Page) {
  let selectors = Array.from(adSelectors);

  // Look up specific selectors for the current domain
  const domain = new URL(page.url()).hostname.replace(/^www\./, '');
  // Identify keys matching the current domain
  const domainKey = Object.keys(specificAdSelectors).filter(key => {
    const regex = new RegExp(key.replace(/\./g, '\\.').replace(/\*/g, '.*'));
    return regex.test(domain);
  });

  // Merge the specific selectors with the general selectors
  if (domainKey.length > 0) {
    const specificSelectors = specificAdSelectors[domainKey[0] as keyof typeof specificAdSelectors];
    if (specificSelectors && Array.isArray(specificSelectors)) {
      log.verbose(`Found ${specificSelectors.length} specific ad selectors for domain: ${domain}`);
      selectors.push(...specificSelectors);
    }
  }

  const ads: JSHandle<Element[]> =
    await page.evaluateHandle((selectors: string[]) => {
      try {
        // Execute all of the input query selectors and collect results in a set.
        let ads = new Set<Element>();
        selectors.forEach((selector) => {
          let matches = document.querySelectorAll(selector);
          matches.forEach((match) => {
            ads.add(match);
          });
        });

        // Remove all elements that are children of another element in the set.
        // We just want the top-most element identified as an ad.
        for (let ad of ads) {
          // For each element in the set, traverse up until it hits <body>, or another
          // element in the set.
          let removed = false;
          let current = ad;
          while (current !== document.body && current.parentNode !== null) {
            current = current.parentNode as Element;
            for (let otherAd of ads) {
              if (current === otherAd) {
                ads.delete(ad);
                removed = true;
                break;
              }
            }
            if (removed) {
              break;
            }
          }
        }
        return Array.from(ads);
      } catch (e) {
        throw e;
      }
    }, selectors);

  const numAds = await ads.evaluate((ads) => ads.length);
  const adHandles = new Set<ElementHandle>();
  for (let i = 0; i < numAds; i++) {
    let ad = await ads.evaluateHandle((ads, idx: number) => ads[idx], i);
    adHandles.add(ad as ElementHandle);
  }
  return adHandles;
}
