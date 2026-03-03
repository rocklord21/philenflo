/**
 * emailverify.io Finder API — quick test script
 *
 * Usage:
 *   EMAILVERIFY_API_KEY=your_key node emailverify-test.js \
 *     --name "John Doe" \
 *     --domain "example.com"
 *
 * Requires Node.js 18+ (uses built-in fetch).
 */

const args = process.argv.slice(2);

function getArg(flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : null;
}

const API_KEY = process.env.EMAILVERIFY_API_KEY;
const name = getArg("--name");
const domain = getArg("--domain");

if (!API_KEY || !name || !domain) {
  console.error(
    "Usage: EMAILVERIFY_API_KEY=<key> node emailverify-test.js --name \"First Last\" --domain \"example.com\""
  );
  process.exit(1);
}

const params = new URLSearchParams({ key: API_KEY, name, domain });
const url = `https://app.emailverify.io/api/v1/finder?${params}`;

(async () => {
  const res = await fetch(url);
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
})();
