import crypto from "node:crypto";

const APP_KEY = process.env.ALIEXPRESS_APP_KEY;
const APP_SECRET = process.env.ALIEXPRESS_APP_SECRET;
const TRACKING_ID = process.env.ALIEXPRESS_TRACKING_ID || "default";

const API_URL = "https://api-sg.aliexpress.com/sync";
const METHOD = "aliexpress.affiliate.product.query";

async function callAliExpress(extraParams) {
  if (!APP_KEY || !APP_SECRET) {
    throw new Error("ALIEXPRESS_APP_KEY / ALIEXPRESS_APP_SECRET غير موجودين في متغيرات البيئة");
  }

  const timestamp = String(Date.now());          // ميلي-ثانية منذ Epoch
  const body = JSON.stringify(extraParams);      // بارامترات العمل فقط في الجسم

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
  const products = Array.isArray(r?.result?.products) ? r.result.products
    : Array.isArray(r?.products) ? r.products
    : Array.isArray(r?.result) ? r.result : [];
  const totalRecordCount = Number(r?.result?.total_results ?? r?.total_results ?? products.length);

  if (!products.length) {
    throw new Error(`AliExpress empty/unexpected response: ${JSON.stringify(data).slice(0, 500)}`);
  }
  return { products, totalRecordCount };
}

  if (!res.ok) throw new Error(`AliExpress HTTP ${res.status}`);
  const data = await res.json();

  // أخطاء TOP بترجع في error_response، مش برمز HTTP فاشل
  if (data.error_response) {
    throw new Error(
      `AliExpress API error ${data.error_response.code || ""}: ${data.error_response.msg || JSON.stringify(data.error_response)}`
    );
  }

  const result = data?.aliexpress_affiliate_product_query_response?.resp_result;
  if (!result || result.resp_code !== 200) {
    throw new Error(`AliExpress unexpected response: ${JSON.stringify(data).slice(0, 500)}`);
  }

  const products = result.result?.products?.product ?? [];
  const totalRecordCount = Number(result.result?.total_record_count ?? products.length);
  return { products, totalRecordCount };
}

/**
 * يجلب منتجات AliExpress بكلمة بحث معيّنة، مع دعم الصفحات حتى سقف معيّن،
 * ويحوّلها لنفس شكل عناصر الفيد المستخدم لعلي بابا (id/title/price/image/url/category).
 * لا يكتب في Supabase مباشرة أبداً — هذا الريبو ما عندوش مفاتيح Supabase أصلاً؛
 * الكتابة تتم لاحقاً عبر /api/public/sync-offers زي فيد علي بابا بالظبط.
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
