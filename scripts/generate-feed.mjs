import { writeFileSync } from "node:fs";

const UA = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept-Language": "ar,en;q=0.9",
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const FALLBACK_CATEGORIES = [
  { name_ar: "الملابس والإكسسوارات", name_en: "Apparel & Accessories", image_url: "https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=500" },
  { name_ar: "الإلكترونيات الاستهلاكية", name_en: "Consumer Electronics", image_url: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500" },
  { name_ar: "المنزل والحديقة", name_en: "Home & Garden", image_url: "https://images.unsplash.com/photo-1513694203232-719a280e022f?w=500" },
  { name_ar: "الجمال والعناية الشخصية", name_en: "Beauty & Personal Care", image_url: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=500" },
  { name_ar: "الآلات والمعدات الصناعية", name_en: "Industrial Machinery", image_url: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=500" },
  { name_ar: "الرياضة والترفيه", name_en: "Sports & Entertainment", image_url: "https://images.unsplash.com/photo-1517649763962-0c623266ddc0?w=500" },
  { name_ar: "قطع غيار السيارات", name_en: "Vehicle Parts", image_url: "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=500" },
  { name_ar: "الهواتف والإكسسوارات", name_en: "Phones & Accessories", image_url: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=500" },
  { name_ar: "المجوهرات والساعات", name_en: "Jewelry & Watches", image_url: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=500" },
];

const PLACEHOLDER_PRODUCTS = [
  { cat: 0, title: "Classic Cotton T-Shirt", title_ar: "تيشيرت قطني كلاسيكي", price: 6.5, old_price: 12, image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500" },
  { cat: 0, title: "Leather Jacket", title_ar: "جاكيت جلدي أنيق", price: 39, old_price: 65, image: "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=500" },
  { cat: 1, title: "Wireless Headphones", title_ar: "سماعات لاسلكية", price: 29.99, old_price: 49.99, image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500" },
  { cat: 1, title: "Vintage Camera", title_ar: "كاميرا كلاسيكية", price: 89, old_price: 120, image: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=500" },
  { cat: 2, title: "Ceramic Vase Set", title_ar: "طقم فازات سيراميك", price: 14.5, old_price: 24, image: "https://images.unsplash.com/photo-1578500494198-246f612d3b3d?w=500" },
  { cat: 2, title: "Modern Table Lamp", title_ar: "مصباح طاولة عصري", price: 18, old_price: 30, image: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=500" },
  { cat: 3, title: "Luxury Perfume", title_ar: "عطر فاخر", price: 25, old_price: 45, image: "https://images.unsplash.com/photo-1541643600914-78b084683601?w=500" },
  { cat: 3, title: "Skincare Set", title_ar: "طقم العناية بالبشرة", price: 19.9, old_price: 32, image: "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=500" },
  { cat: 4, title: "Electric Power Drill", title_ar: "دريل كهربائي", price: 45, old_price: 70, image: "https://images.unsplash.com/photo-1504148455328-c376907d081c?w=500" },
  { cat: 4, title: "Measuring Tools Set", title_ar: "طقم أدوات قياس", price: 22, old_price: 35, image: "https://picsum.photos/seed/tools/500" },
  { cat: 5, title: "Yoga Mat", title_ar: "سجادة يوغا", price: 12, old_price: 20, image: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=500" },
  { cat: 5, title: "Camping Tent", title_ar: "خيمة تخييم", price: 55, old_price: 85, image: "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=500" },
  { cat: 6, title: "Car LED Headlight", title_ar: "مصباح LED للسيارة", price: 24, old_price: 40, image: "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=500" },
  { cat: 6, title: "Oil Filter Set", title_ar: "طقم فلاتر زيت", price: 9.9, old_price: 16, image: "https://picsum.photos/seed/autoparts/500" },
  { cat: 7, title: "Smartphone X20", title_ar: "هاتف ذكي X20", price: 120, old_price: 180, image: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=500" },
  { cat: 7, title: "Silicone Phone Case", title_ar: "غطاء هاتف سيليكون", price: 3.5, old_price: 7, image: "https://picsum.photos/seed/phonecase/500" },
  { cat: 8, title: "Classic Wrist Watch", title_ar: "ساعة يد كلاسيكية", price: 35, old_price: 60, image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500" },
  { cat: 8, title: "Silver Ring", title_ar: "خاتم فضي", price: 8.9, old_price: 15, image: "https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=500" },
];

// مطابقة الصنف الحي بأقرب مجموعة منتجات جاهزة
function matchGroup(cat) {
  const t = `${cat.name_ar} ${cat.name_en}`;
  if (/هاتف|هواتف|جوال|جوالات|اتصالات/.test(t)) return 7;
  if (/ملابس|أزياء|نسائ|رجال|موضة|أحذية|حقائب/.test(t)) return 0;
  if (/كمبيوتر|حاسوب|إلكترون|الكترون|كهربائ|صوتيات/.test(t)) return 1;
  if (/منزل|منزلي|مطبخ|حديق|أثاث|ديكور|إنارة/.test(t)) return 2;
  if (/جمال|تجميل|عناية|مكياج|عطور/.test(t)) return 3;
  if (/آلات|صناع|زراع|معدات|عدد/.test(t)) return 4;
  if (/رياض|ترفيه|ألعاب|لياقة|تخييم/.test(t)) return 5;
  if (/سيار|مركب|دراج|قطع غيار/.test(t)) return 6;
  if (/مجوهر|ساعات|خواتم|فضة|ذهب/.test(t)) return 8;
  return -1;
}

function cleanAndFormatCategory(rawName) {
  let cleanAr = rawName
    .replace(/يتكرر البحث عنها/g, "")
    .replace(/شائع البحث/g, "")
    .replace(/البحث عن/g, "")
    .replace(/[Gg]5/g, "")
    .trim();
  if (!cleanAr) cleanAr = "منتجات عامة";
  let cleanEn = cleanAr;
  if (cleanAr.includes("أطقم نسائية") || cleanAr.includes("نساء")) cleanEn = "Women's Fashion Sets";
  else if (cleanAr.includes("الشيشة")) cleanEn = "Hookah & Accessories";
  else if (cleanAr.includes("الهواتف") || cleanAr.includes("هاتف")) cleanEn = "Smartphones & Mobile";
  else if (cleanAr.includes("طائرة") || cleanAr.includes("طيار")) cleanEn = "Drones & RC Tech";
  else if (cleanAr.includes("حمامات") || cleanAr.includes("سباحة")) cleanEn = "Swimming Pools & Gear";
  else if (cleanAr.includes("غرفة المعيشة") || cleanAr.includes("أثاث")) cleanEn = "Living Room Furniture";
  else if (cleanAr.includes("سيارات") || cleanAr.includes("سيارة")) cleanEn = "Auto Accessories";
  else if (cleanAr.includes("مجوهرات")) cleanEn = "Jewelry & Rings";
  return { name_ar: cleanAr, name_en: cleanEn };
}

async function fetchText(url) {
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(12000), redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
}

async function scrapeCategories() {
  try {
    const html = await fetchText("https://arabic.alibaba.com");
    const cats = [];
    const re = /<a\b[^>]*href="[^"]*(?:category|trade\/search)[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
    let m;
    while ((m = re.exec(html)) !== null) {
      const inner = m[1];
      const text = inner.replace(/<[^>]+>/g, "").trim();
      const img = (inner.match(/<img[^>]*(?:src|data-src)="([^"]+)"/) || [])[1];
      if (text && text.length > 2 && text.length < 50) {
        const { name_ar, name_en } = cleanAndFormatCategory(text);
        if (!cats.some((c) => c.name_ar === name_ar)) {
          cats.push({ name_ar, name_en, image_url: img ? (img.startsWith("//") ? `https:${img}` : img) : "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=500" });
        }
      }
    }
    if (cats.length > 0) { console.log(`🌐 أصناف حية من علي بابا: ${cats.length}`); return cats; }
  } catch (e) { console.warn("⚠️ تعذر سحب الأصناف الحية:", e.message); }
  console.log("📦 سيتم استخدام الأصناف الاحتياطية");
  return FALLBACK_CATEGORIES;
}

async function scrapeProducts(query) {
  try {
    const html = await fetchText(`https://arabic.alibaba.com/trade/search?SearchText=${encodeURIComponent(query)}`);
    const found = [];
    let m;
    const objRe = /{[^{}]*"subject"\s*:\s*"[^"]+"[^{}]*}/g;
    while ((m = objRe.exec(html)) !== null) {
      const chunk = m[0];
      const title = (chunk.match(/"subject"\s*:\s*"([^"]+)"/) || [])[1];
      const price = (chunk.match(/"price"\s*:\s*"?([\d.]+)"?/) || [])[1];
      const img = (chunk.match(/"(?:imageUrl|image|mainImage)"\s*:\s*"(https?:[^"]+|\/\/[^"]+)"/) || [])[1];
      const link = (chunk.match(/"(?:productUrl|href|url)"\s*:\s*"(https?:[^"]+|\/\/[^"]+)"/) || [])[1];
      if (title) found.push({ title, price: price ? Number(price) : null, img: img || null, link: link || null });
      if (found.length >= 2) break;
    }
    if (found.length === 0) {
      const aRe = /<a\b[^>]*href="((?:https?:)?\/\/[^"]*\/product\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
      while ((m = aRe.exec(html)) !== null) {
        const link = m[1];
        const title = m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        const img = (m[2].match(/<img[^>]*(?:src|data-src)="([^"]+)"/) || [])[1];
        if (title && title.length > 5 && title.length < 90) found.push({ title, price: null, img: img || null, link });
        if (found.length >= 2) break;
      }
    }
    return found;
  } catch { return []; }
}

// ---------- التنفيذ ----------
const cats = await scrapeCategories();
const isFallback = cats === FALLBACK_CATEGORIES;
const items = [];
let liveCount = 0;

for (let c = 0; c < cats.length; c++) {
  const cat = cats[c];
  const live = (await scrapeProducts(cat.name_ar)).slice(0, 2);
  if (live.length > 0) {
    liveCount += live.length;
    live.forEach((p, i) => {
      items.push({
        id: `alb-${c}-${i}`,
        title: p.title,
        title_ar: p.title,
        description_ar: `منتج حقيقي من قسم ${cat.name_ar} — علي بابا`,
        price: p.price ?? 0,
        currency: "USD",
        image: p.img ? (p.img.startsWith("//") ? `https:${p.img}` : p.img) : cat.image_url,
        url: p.link ? (p.link.startsWith("//") ? `https:${p.link}` : p.link) : `https://arabic.alibaba.com/trade/search?SearchText=${encodeURIComponent(cat.name_ar)}`,
        category: cat.name_en,
      });
    });
    console.log(`✅ ${cat.name_ar}: تم سحب ${live.length} منتج حقيقي`);
  } else {
    const g = isFallback ? c : matchGroup(cat);
    const ph = g >= 0
      ? PLACEHOLDER_PRODUCTS.filter((x) => x.cat === g)
      : [1, 2].map((n) => ({ title: `${cat.name_en} Pick ${n}`, title_ar: `${cat.name_ar} — مختار ${n}`, price: 0, old_price: null, image: cat.image_url }));
    ph.forEach((p, i) => {
      items.push({
        id: `alb-${c}-${i}`,
        title: p.title,
        title_ar: p.title_ar,
        description_ar: `منتج مميز من قسم ${cat.name_ar}`,
        price: p.price,
        old_price: p.old_price ?? undefined,
        currency: "USD",
        image: p.image,
        url: `https://arabic.alibaba.com/trade/search?SearchText=${encodeURIComponent(cat.name_ar)}`,
        category: cat.name_en,
      });
    });
    console.log(`📦 ${cat.name_ar}: منتجات احتياطية (الحجب من علي بابا)`);
  }
  await sleep(600);
}

writeFileSync("feed.json", JSON.stringify({ items }, null, 2));
console.log(`✅ الإجمالي: ${items.length} عنصراً — حقيقي: ${liveCount} — احتياطي: ${items.length - liveCount}`);
