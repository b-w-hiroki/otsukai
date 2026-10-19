import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import staticSearchContract from "./static-search-contract.cjs";

const { auditStaticSearch } = staticSearchContract;

const read = (file) => readFileSync(file, "utf8");
const index = read("index.html");

assert.match(index, /<meta name="description" content="[^"]+"/);
assert.match(index, /<link rel="canonical" href="https:\/\/otsukai\.birdman-studio\.com\/"/);
assert.match(index, /<meta property="og:title" content="[^"]+"/);
assert.match(index, /<script type="application\/ld\+json">[\s\S]*"@type": "WebApplication"/);

for (const file of ["app.html", "app.v1.html", "hub.html"]) {
  assert.match(read(file), /<meta name="robots" content="noindex, nofollow, noarchive"/,
    `${file} must stay out of search indexes`);
}
for (const file of ["contact.html", "news-item.html"]) {
  assert.match(read(file), /<meta name="robots" content="noindex, follow"/,
    `${file} must stay out of search indexes`);
}

const robots = read("robots.txt");
for (const path of ["/docs/", "/functions/", "/tests/"]) {
  assert.ok(robots.includes(`Disallow: ${path}`), `${path} must be disallowed`);
}
for (const image of [
  "01-home.png", "02-lowstock.png", "03-add-sheet.png", "08-shortcuts.png",
  "09-history.png", "10-missions.png", "11-stock.png", "12-settings.png",
  "14-maintenance.png", "15-dark.png", "19-expenses.png",
]) {
  assert.ok(robots.includes(`Allow: /docs/screenshots/${image}`), `${image} must be crawlable`);
}
for (const privateScreenshot of ["04-claimed.png", "13-member-admin.png", "news/"]) {
  assert.ok(!robots.includes(`Allow: /docs/screenshots/${privateScreenshot}`),
    `${privateScreenshot} must not be explicitly allowed`);
}
assert.ok(robots.includes("Sitemap: https://otsukai.birdman-studio.com/sitemap.xml"));

const sitemap = read("sitemap.xml");
for (const url of ["https://otsukai.birdman-studio.com/", ...[
  "guide.html", "news.html", "privacy.html", "terms.html",
].map((path) => `https://otsukai.birdman-studio.com/${path}`)]) {
  assert.ok(sitemap.includes(`<loc>${url}</loc>`), `${url} missing from sitemap`);
  if (url !== "https://otsukai.birdman-studio.com/") {
    const file = url.split("/").at(-1);
    assert.ok(read(file).includes(`<link rel="canonical" href="${url}"`), `${file} canonical mismatch`);
  }
}
for (const privatePath of ["app.html", "app.v1.html", "hub.html", "?action=", "?invite="]) {
  assert.ok(!sitemap.includes(privatePath), `${privatePath} must not be in sitemap`);
}

auditStaticSearch({ baseUrl: "https://otsukai.birdman-studio.com/" });

console.log("search discovery contract passed");
