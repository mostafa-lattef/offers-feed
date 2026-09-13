import { writeFileSync } from "node:fs";
import { fetchAliExpressProducts } from "./aliexpress.mjs";

// ===== المصدر: خزان علي بابا الحقيقي على GitHub =====
const GITHUB_FEED_URL = "https://raw.githubusercontent.com/mostafa-lattef/offers-feed/main/ali-feed.json";

// كلمات بحث AliExpress — عدّلها زي ما يناسبك، أو سيبها فاضية لتعطيل الجلب من AliExpress تماماً
const ALIEXPRESS_KEYWORDS = ["trending", "hot sale", "best seller"];

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

console.log("Fetched:", raw.length, "real products (Alibaba)");

// جلب منتجات AliExpress إضافياً — يعمل فقط إذا كانت المفاتيح موجودة في متغيرات البيئة
// (secrets في GitHub Actions). فشل AliExpress هنا لا يوقف تحديث فيد علي بابا.
let aliexpressItems = [];
if (process.env.ALIEXPRESS_APP_KEY && process.env.ALIEXPRESS_APP_SECRET) {
  for (const kw of ALIEXPRESS_KEYWORDS) {
    try {
      const found = await fetchAliExpressProducts(kw, { maxPages: 2, pageSize: 50 });
      aliexpressItems.push(...found);
      console.log(`AliExpress "${kw}":`, found.length, "products");
    } catch (e) {
      console.error(`AliExpress "${kw}" failed:`, e.message);
    }
  }
} else {
  console.log("AliExpress keys not set — skipping AliExpress fetch.");
}

if (raw.length === 0 && aliexpressItems.length === 0) {
  console.error("Empty feed — feed.json NOT overwritten");
  process.exit(1);
}

const alibabaItems = raw.map((p) => ({
  id: p.id || "ali-" + Math.random().toString(36).slice(2),
  title: p.title || "",
  title_ar: p.title_ar || "",
  description_ar: p.description_ar || "",
  price: Number(p.price) || 0,
  currency: p.currency || "USD",
  image: p.image || p.image_url || "",
  url: p.url || p.source_url || "",
  category: p.category || "General",
  feed: p.feed || "alibaba",
  is_real: true
}));

// دمج المصدرين مع إزالة أي تكرار بالـid
const seenIds = new Set();
const items = [];
for (const it of [...alibabaItems, ...aliexpressItems]) {
  if (seenIds.has(it.id)) continue;
  seenIds.add(it.id);
  items.push(it);
}

writeFileSync("feed.json", JSON.stringify({ items }, null, 2));

const cats = {};
for (const i of items) cats[i.category] = (cats[i.category] || 0) + 1;
console.log("Done: feed.json with", items.length, "real products");
for (const k of Object.keys(cats).sort()) console.log("  ", k, ":", cats[k]);
