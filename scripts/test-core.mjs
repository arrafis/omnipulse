import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

// Pure modules have type-only imports. Compile in memory; no Worker/D1 needed.
async function moduleAt(path) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}
const { parseFeed } = await moduleAt("../lib/rss.ts");
const { readReadingList } = await moduleAt("../lib/reading-list.ts");
const feed = { name: "Example", category: "AI", host: "example.com", url: "https://example.com/rss" };
const now = "2026-10-14T01:00:00.000Z";
function rss(url = "https://example.com/story#fragment", date = "2026-10-13T23:00:00Z", title = "AI &amp; news") {
  return `<item><title>${title}</title><link>${url}</link><pubDate>${date}</pubDate><description><![CDATA[<p>A useful <b>publisher</b> summary.</p>]]></description></item>`;
}
let count = 0;
function check(name, test) { test(); count++; console.log(`PASS ${name}`); }
check("RSS decodes entities, removes markup and normalizes fragments", () => {
  const [item] = parseFeed(rss(), feed, now);
  assert.equal(item.title, "AI & news"); assert.equal(item.summary, "A useful publisher summary."); assert.equal(item.url, "https://example.com/story");
});
check("Untrusted hosts and executable or insecure URLs are excluded", () => {
  for (const url of ["javascript:alert(1)", "http://example.com/a", "https://example.com.evil.test/a", "https://evil.test/a"]) assert.equal(parseFeed(rss(url), feed, now).length, 0);
  assert.equal(parseFeed(rss("https://news.example.com/a"), feed, now).length, 1);
});
check("Invalid, old and implausibly future dates are excluded", () => {
  for (const date of ["invalid", "2026-01-01", "2026-10-15"]) assert.equal(parseFeed(rss(undefined, date), feed, now).length, 0);
});
check("Malformed Unicode entity does not discard the entire feed", () => {
  const items = parseFeed(rss(undefined, undefined, "Bad &#999999999; code") + rss(), feed, now);
  assert.equal(items.length, 2); assert.ok(items[0].title.includes("�"));
});
check("Atom chooses the alternate story link over the self link", () => {
  const xml = `<entry><title>Atom story</title><link rel="self" href="https://example.com/api"/><link href="https://example.com/article" rel="alternate"/><updated>2026-10-13T23:00:00Z</updated><summary>Readable summary</summary></entry>`;
  assert.equal(parseFeed(xml, feed, now)[0].url, "https://example.com/article");
});
check("Publisher excerpts remain bounded", () => {
  const xml = rss().replace("A useful <b>publisher</b> summary.", "long excerpt ".repeat(100));
  assert.ok(parseFeed(xml, feed, now)[0].summary.length <= 240);
});
const story = { url: "https://example.com/a", title: "Saved story", category: "AI", source: "Example", published_at: now, summary: "Summary" };
check("Corrupt reading-list storage recovers to an empty list", () => {
  for (const raw of [null, "broken", "{}", "null", '[null,42,"bad"]']) assert.deepEqual(readReadingList(raw), []);
});
check("Reading list rejects unsafe URLs and duplicate entries", () => {
  const items = readReadingList(JSON.stringify([story, story, { ...story, url: "javascript:alert(1)" }, {...story, url:"https://example.com/b", published_at:"bad"}]));
  assert.equal(items.length, 1); assert.equal(items[0].url, story.url);
});
check("Reading list caps storage at 100 stories", () => {
  assert.equal(readReadingList(JSON.stringify(Array.from({length:120}, (_,i) => ({...story, url:`https://example.com/${i}`})))).length, 100);
});
console.log(`${count} core checks passed.`);
