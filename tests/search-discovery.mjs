import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

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

console.log("search discovery contract passed");
