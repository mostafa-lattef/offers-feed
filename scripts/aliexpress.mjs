import crypto from "node:crypto";

// ===== AliExpress Open Platform (Affiliate API) =====
// المفاتيح تُقرأ من متغيرات البيئة فقط — لا قيم افتراضية هنا أبداً.
const clean = (v) => (v || "").replace(/\s+/g, "");   // يكنس كل فراغٍ أينما اختبأ
const APP_KEY = clean(process.env.ALIEXPRESS_APP_KEY);
const APP_SECRET = clean(process.env.ALIEXPRESS_APP_SECRET);
const TRACKING_ID = clean(process.env.ALIEXPRESS_TRACKING_ID) || "default";

// البوابة الجديدة لمنصة AliExpress المفتوحة
const API_URL = "https://api-sg.aliexpress.com/sync";
const METHOD = "aliexpress.affiliate.product.query";
console.error(`[debug] APP_KEY preview: ${APP_KEY?.slice(0, 4)}… len=${APP_KEY?.length}`);
console.error(`[debug] APP_SECRET len=${APP_SECRET?.length}`);
async function callAliExpress(extraParams) {
  if (!APP_KEY || !APP_SECRET) {
    throw new Error("ALIEXPRESS_APP_KEY / ALIEXPRESS_APP_SECRET غير موجودين في متغيرات البيئة");
  }

  const timestamp = String(Date.now());          // ميلي-ثانية منذ Epoch
  const body = JSON.stringify(extraParams);      // بارامترات العمل في الجسم

  // توقيع المنصة الجديدة: HMAC-SHA256( Secret , appKey+method+timestamp+body )
  const sign = crypto
    .createHmac("sha256", APP_SECRET)
    .update(APP_KEY + METHOD + timestamp + body, "utf8")
    .digest("hex")
    .toUpperCase();

  const url =
    `${API_URL}?app_key=${encodeURIComponent(APP_KEY)}` +
    `&method=${encodeURIComponent(METHOD)}` +
    `&timestamp=${timestamp}` +
    `&sign_method=sha256` +
    `&sign=${encodeURIComponent(sign)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) throw new Error(`AliExpress HTTP ${res.status}`);
  const data = await res.json();

  if (data?.code && data.code !== 0) {
    throw new Error(`AliExpress API error ${data.code}: ${data.message ?? JSON.stringify(data).slice(0, 300)}`);
  }

  const r = data?.aliexpress_affiliate_product_query_response ?? data;
  const products = Array.isArray(r?.result?.products)
    ? r.result.products
    : Array.isArray(r?.products)
      ? r.products
      : Array.isArray(r?.result)
        ? r.result
        : [];
  const totalRecordCount = Number(r?.result?.total_results ?? r?.total_results ?? products.length);

  if (!products.length) {
    throw new Error(`AliExpress empty/unexpected response: ${JSON.stringify(data).slice(0, 500)}`);
  }

  return { products, totalRecordCount };
}

/**
 * يجلب منتجات AliExpress بكلمة بحث، ويحوّلها لنفس شكل عناصر فيد علي بابا.
 * لا يكتب في Supabase — الكتابة تتم لاحقاً عبر /api/public/sync-offers.
 */
export async function fetchAliExpressProducts(keywords = "trending", { maxPages = 4, pageSize = 50 } = {}) {
  const items = [];
  let page = 1;

  while (page <= maxPages) {
    let products, totalRecordCount;
    try {
      ({ products, totalRecordCount } = await callAliExpress({
        keywords,
        page_no: page,
        page_size: pageSize,
        target_currency: "USD",
        target_language: "EN",
        tracking_id: TRACKING_ID,
      }));
    } catch (e) {
      const detail = e?.cause?.code || e?.cause?.message || e.message;
      console.error(`AliExpress fetch failed (keywords="${keywords}", page=${page}): ${e.message} — cause: ${detail}`);
      break;
    }

    if (!products.length) break;

    for (const p of products) {
      items.push({
        id: "aex-" + (p.product_id ?? Math.random().toString(36).slice(2)),
        title: p.product_title || "",
        title_ar: "",
        description_ar: "",
        price: Number(p.target_sale_price ?? p.app_sale_price ?? p.original_price ?? 0) || 0,
        currency: p.target_sale_price_currency || "USD",
        image: p.product_main_image_url || "",
        url: p.promotion_link || p.product_detail_url || "",
        category: p.first_level_category_name || p.second_level_category_name || "General",
        feed: "aliexpress",
        is_real: true,
      });
    }

    if (page * pageSize >= totalRecordCount) break;
    page++;
  }

  return items;
}
