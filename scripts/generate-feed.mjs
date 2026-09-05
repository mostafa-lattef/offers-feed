import { writeFileSync } from "node:fs";

// ===== المصدر: خزان علي بابا الحقيقي على GitHub =====
const GITHUB_FEED_URL = "https://raw.githubusercontent.com/mostafa-lattef/offers-feed/main/ali-feed.json";

async function fetchFeed(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error("HTTP " + res.status);
  const data = await res.json();
  return Array.isArray(data) ? data : (data.items || []);
}

let raw = [];
try {
  raw = await fetchFeed(GITHUB_FEED_URL);
} catch (e) {
  console.error("Fetch failed:", e.message);
}

console.log("Fetched:", raw.length, "real products");

if (raw.length === 0) {
  console.error("Empty feed — feed.json NOT overwritten");
  process.exit(1);
}

const items = raw.map((p) => ({
  id: p.id || "ali-" + Math.random().toString(36).slice(2),
  title: p.title || "",
  title_ar: p.title_ar || "",
  description_ar: p.description_ar || "",
  price: Number(p.price) || 0,
  currency: p.currency || "USD",
  image: p.image || p.image_url || "",
  url: p.url || p.source_url || "",
  category: p.category || "General",
  is_real: true
}));

writeFileSync("feed.json", JSON.stringify({ items }, null, 2));

const cats = {};
for (const i of items) cats[i.category] = (cats[i.category] || 0) + 1;
console.log("Done: feed.json with", items.length, "real products");
for (const k of Object.keys(cats).sort()) console.log("  ", k, ":", cats[k]);
