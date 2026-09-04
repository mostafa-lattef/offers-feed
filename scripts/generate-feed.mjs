import { writeFileSync } from "node:fs";

const UA = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept-Language": "ar,en;q=0.9",
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ===== التصنيفات الأساسية (نفس القائمة القديمة) =====
const BASE_CATEGORIES = [
  { name_ar: "الملابس والإكسسوارات", name_en: "Apparel & Accessories", keyword: "fashion" },
  { name_ar: "الإلكترونيات الاستهلاكية", name_en: "Consumer Electronics", keyword: "tech" },
  { name_ar: "المنزل والحديقة", name_en: "Home & Garden", keyword: "furniture" },
  { name_ar: "الجمال والعناية الشخصية", name_en: "Beauty & Personal Care", keyword: "cosmetics" },
  { name_ar: "الآلات والمعدات الصناعية", name_en: "Industrial Machinery", keyword: "tools" },
  { name_ar: "الرياضة والترفيه", name_en: "Sports & Entertainment", keyword: "fitness" },
  { name_ar: "قطع غيار السيارات", name_en: "Vehicle Parts", keyword: "carparts" },
  { name_ar: "الهواتف والإكسسوارات", name_en: "Phones & Accessories", keyword: "smartphone" },
  { name_ar: "المجوهرات والساعات", name_en: "Jewelry & Watches", keyword: "watch" },
  { name_ar: "ألعاب الأطفال والمستلزمات", name_en: "Toys & Baby Items", keyword: "toys" },
];

// ===== خريطة تصنيفات فيد علي بابا → تصنيفات ميركورا =====
const CATEGORY_MAP = {
  "school & office supplies": "Consumer Electronics",
  "consumer electronics": "Consumer Electronics",
  "electronics": "Consumer Electronics",
  "phones & accessories": "Phones & Accessories",
  "smartphone": "Phones & Accessories",
  "apparel": "Apparel & Accessories",
  "fashion": "Apparel & Accessories",
  "shoes & accessories": "Apparel & Accessories",
  "home & garden": "Home & Garden",
  "furniture": "Home & Garden",
  "home appliances": "Home & Garden",
  "beauty & personal care": "Beauty & Personal Care",
  "cosmetics": "Beauty & Personal Care",
  "health & medical": "Beauty & Personal Care",
  "industrial machinery": "Industrial Machinery",
  "tools": "Industrial Machinery",
  "hardware": "Industrial Machinery",
  "sports & entertainment": "Sports & Entertainment",
  "fitness": "Sports & Entertainment",
  "vehicle parts": "Vehicle Parts",
  "auto parts": "Vehicle Parts",
  "jewelry & watches": "Jewelry & Watches",
  "watch": "Jewelry & Watches",
  "toys & hobbies": "Toys & Baby Items",
  "baby & kids": "Toys & Baby Items",
};

const ADJECTIVES_AR = ["الاحترافي", "الفاخر", "العصري", "الممتاز", "المبتكر", "الأنيق", "عالي الجودة", "الذكي"];
const ADJECTIVES_EN = ["Pro", "Luxury", "Modern", "Premium", "Smart", "Ultra", "Elite", "Classic"];

// ===== محاولة جلب فيد حقيقي من GitHub =====
async function fetchGithubFeed(url) {
  try {
    const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(10000) });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : (data.items || []);
  } catch {
    return [];
  }
}

// ===== توحيد أسماء الحقول من فيد علي بابا إلى البنية المطلوبة =====
function normalizeRealProduct(p) {
  const rawCat = (p.category || "").toLowerCase().trim();
  const catEn = CATEGORY_MAP[rawCat] || BASE_CATEGORIES[0].name_en;

  return {
    id: `ali-${p.sku || p.id || Math.random().toString(36).slice(2)}`,
    title: p.name_en || p.title || "",
    title_ar: p.name_ar || p.title_ar || "",
    description_ar: p.description || `منتج حقيقي من قسم ${catEn}`,
    price: Number(p.price) || 0,
    currency: p.currency || "USD",
    image: p.image_url || p.image || "",
    url: p.source_url || p.url || "",
    category: catEn,
    is_real: true,
  };
}

// ===== مولد المنتجات الافتراضية (طوق النجاة) =====
function generateProductsForCategory(catIndex, cat, count = 15) {
  const products = [];
  for (let i = 1; i <= count; i++) {
    const adjAr = ADJECTIVES_AR[i % ADJECTIVES_AR.length];
    const adjEn = ADJECTIVES_EN[i % ADJECTIVES_EN.length];
    const price = Number((Math.random() * 120 + 15).toFixed(2));
    const imageSeed = `${cat.keyword}-${catIndex}-${i}`;
    products.push({
      id: `gen-${catIndex}-${i}`,
      title: `${cat.name_en} ${adjEn} Model-${i}`,
      title_ar: `${cat.name_ar} ${adjAr} — موديل ${i}`,
      description_ar: `منتج افتراضي احتياطي لقسم ${cat.name_ar}`,
      price,
      currency: "USD",
      image: `https://picsum.photos/seed/${imageSeed}/600/600`,
      url: `https://arabic.alibaba.com/trade/search?SearchText=${encodeURIComponent(cat.name_ar)}`,
      category: cat.name_en,
      is_real: false,
    });
  }
  return products;
}

// ===== التنفيذ =====
const GITHUB_FEED_URL = process.env.GITHUB_FEED_URL ||
  "https://raw.githubusercontent.com/YOUR_USERNAME/mercora-feeds/main/ali-feed.json";

const PRODUCTS_PER_CAT = 12;
const items = [];

console.log("📡 محاولة جلب المنتجات الحقيقية من GitHub...");
const realProducts = await fetchGithubFeed(GITHUB_FEED_URL);
console.log(`   ${realProducts.length > 0 ? "✅" : "⚠️"} استُقبل ${realProducts.length} منتجاً حقيقياً\n`);

// توزيع المنتجات الحقيقية على التصنيفات
const realByCat = {};
for (const p of realProducts) {
  const norm = normalizeRealProduct(p);
  (realByCat[norm.category] ||= []).push(norm);
}

for (let c = 0; c < BASE_CATEGORIES.length; c++) {
  const cat = BASE_CATEGORIES[c];
  const catReals = realByCat[cat.name_en] || [];
  items.push(...catReals.slice(0, PRODUCTS_PER_CAT));

  const needed = Math.max(0, PRODUCTS_PER_CAT - catReals.length);
  if (needed > 0) {
    items.push(...generateProductsForCategory(c, cat, needed));
  }

  console.log(`✅ [${cat.name_ar}]: حقيقي ${Math.min(catReals.length, PRODUCTS_PER_CAT)} + افتراضي ${needed} = ${PRODUCTS_PER_CAT}`);
}

writeFileSync("feed.json", JSON.stringify({ items }, null, 2));

const realCount = items.filter((i) => i.is_real).length;
const mockCount = items.filter((i) => !i.is_real).length;
console.log(`\n🎉 اكتمل: ${realCount} منتجاً حقيقياً + ${mockCount} افتراضياً = ${items.length} إجمالي`);
