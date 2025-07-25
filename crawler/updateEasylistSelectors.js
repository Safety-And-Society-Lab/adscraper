import fs from 'fs';

// Script to update the ad CSS selectors file (used internally to detect ads)
// with the latest definitions from Easylist.
async function fetchGeneralFilterList(url) {
  const res = await fetch(url);
  if (!res.ok) {
    console.log(res.statusText);
    process.exit(1);
  }
  const raw = await res.text();
  const rows = raw.split('\n');
  const selectorRows = rows
      .filter(r => r.startsWith('##'))
      .map(row => row.substring(2));
  return selectorRows;
}

async function fetchSpecificFilterList(url) {
  const res = await fetch(url);
  if (!res.ok) {
    console.log(res.statusText);
    process.exit(1);
  }
  const raw = await res.text();
  const rows = raw.split('\n');
  const selectorRows = rows
    // Filter out comments, invalid rows
    .filter(r => !r.startsWith('!') && r.includes('##') && !r.startsWith('##'))
    .map(row => {
      const parts = row.split('##');
      if (parts.length < 2) {
        console.log(row);
        return null; // Skip rows that don't have a valid format
      }
      const domains = parts[0].split(',');
      return {
        domains: domains,
        selector: parts[1]
      };
    });

  let results = {};
  for (const row of selectorRows) {
    for (const domain of row.domains) {
      if (!results[domain]) {
        results[domain] = [];
      }
      results[domain].push(row.selector);
    }
  }
  return results;
}

async function main () {
  let generalHide = await fetchGeneralFilterList(
    'https://raw.githubusercontent.com/easylist/easylist/master/easylist/easylist_general_hide.txt');
  fs.writeFileSync('src/ads/easylist_ad_selectors.json', JSON.stringify(generalHide, null, 2));
  console.log('Wrote ad selectors to src/ads/easylist_ad_selectors.json');

  let specificHide = await fetchSpecificFilterList(
    'https://raw.githubusercontent.com/easylist/easylist/master/easylist/easylist_specific_hide.txt');

  let adultSpecificHide = await fetchSpecificFilterList(
    'https://raw.githubusercontent.com/easylist/easylist/master/easylist_adult/adult_specific_hide.txt');

  let specificHideCombined = {...specificHide, ...adultSpecificHide};
  fs.writeFileSync('src/ads/easylist_ad_specific_selectors.json', JSON.stringify(specificHideCombined, null, 2));
  console.log('Wrote domain-specific selectors to src/ads/easylist_ad_specific_selectors.json');

  let cookieHide = await fetchGeneralFilterList(
    'https://raw.githubusercontent.com/easylist/easylist/master/easylist_cookie/easylist_cookie_general_hide.txt');
  fs.writeFileSync('src/pages/easylist_cookie_general_hide.json', JSON.stringify(cookieHide, null, 2));
  console.log('Wrote cookie banner selectors to src/pages/easylist_cookie_general_hide.json');

  let cookieSpecificHide = await fetchSpecificFilterList(
    'https://raw.githubusercontent.com/easylist/easylist/refs/heads/master/easylist_cookie/easylist_cookie_specific_hide.txt');
  fs.writeFileSync('src/pages/easylist_cookie_specific_hide.json', JSON.stringify(cookieSpecificHide, null, 2));
  console.log('Wrote domain-specific cookie banner selectors to src/pages/easylist_cookie_specific_hide.json');

  console.log('Done');
  process.exit(0);
}

main();
