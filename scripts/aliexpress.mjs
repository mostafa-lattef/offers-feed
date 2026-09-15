import crypto from "node:crypto";

// ===== AliExpress Open Platform (Affiliate API) =====
const clean = (v) => (v || "").replace(/\s+/g, "");
const APP_KEY = clean(process.env.ALIEXPRESS_APP_KEY);
const APP_SECRET = clean(process.env.ALIEXPRESS_APP_SECRET);
const TRACKING_ID = clean(process.env.ALIEXPRESS_TRACKING_ID) || "default";
let ACCESS_TOKEN = clean(process.env.ALIEXPRESS_ACCESS_TOKEN);
const REFRESH_TOKEN = clean(process.env.ALIEXPRESS_REFRESH_TOKEN);
const TOKEN_EXPIRES_AT = Number(process.env.ALIEXPRESS_TOKEN_EXPIRES_AT || 0);

const SYNC_URL = "https://api-sg.aliexpress.com/sync";   // TOP: منتجات
const REST_URL = "https://api-sg.aliexpress.com/rest";   // GOP: توكنات
const METHOD = "aliexpress.affiliate.product.query";

console.error(`[debug] APP_KEY preview: ${APP_KEY?.slice(0, 4)}… len=${APP_KEY?.length}`);
console.error(`[debug] ACCESS_TOKEN len=${ACCESS_TOKEN?.length}`);

// صيغة TOP الرسمية: yyyy-MM-dd HH:mm:ss بتوقيت الصين (UTC+8)
function chinaTime() {
  const d = new Date(Date.now() + 8 * 3600e3);
  return d.toISOString().replace("T", " ").substring(0, 19);
}

// البصمة في TOP: apiName فارغة → س = k1v1k2v2… (HMAC-SHA256 للسر)
const hmacUpper = (s) => crypto.createHmac("sha256", APP_SECRET).update(s, "utf8").digest("hex").toUpperCase();
function signTop(params) {
  let s = "";
  for (const k of Object.keys(params).sort()) {
    const v = params[k];
    if (v != null && v !== "") s += k + v;
  }
  return hmacUpper(s);
}

// نداء REST (التوكنات): /rest + apiName — التركيبة المثبتة
async function callRest(apiName, biz) {
  const params = { app_key: APP_KEY, sign_method: "sha256", timestamp: String(Date.now()), ...biz };
  let s = apiName;
  for (const k of Object.keys(params).sort()) { const v = params[k]; if (v) s += k + v; }
  const sign = hmacUpper(s);
  const url = `${REST_URL}${apiName}?` + new URLSearchParams({ ...params, sign }).toString();
  const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
  return res.json();
}

// نداء TOP (المنتجات): GET مع session=T وكل شيء في query
async function callSync(biz) {
  const common = {
    app_key: APP_KEY,
    method: METHOD,
    v: "2.0",
    format: "json",
    timestamp: chinaTime(),
    sign_method: "sha256",
    partner_id: "iop-node-sdk",
    session: ACCESS_TOKEN,
    ...biz,
  };
  const sign = signTop(common);
  const url = `${SYNC_URL}?method=${encodeURIComponent(METHOD)}&` + new URLSearchParams({ ...common, sign }).toString();
  const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`AliExpress HTTP ${res.status}`);
  return res.json();
}

// تجديد التوكن عند الانتهاء (تذكير: حدّث الأسرار يدويًا بعدها)
async function ensureToken() {
  if (!ACCESS_TOKEN) throw new Error("ALIEXPRESS_ACCESS_TOKEN غير موجود في Secrets");
  if (TOKEN_EXPIRES_AT && Date.now() > TOKEN_EXPIRES_AT - 3600_000) {
    if (!REFRESH_TOKEN) throw new Error("التوكن منتهٍ وALIEXPRESS_REFRESH_TOKEN غير موجود");
    console.error("[auth] ⏰ التوكن منتهٍ — تجديد لهذه الجولة فقط…");
    const r = await callRest("/auth/token/refresh", { refresh_token: REFRESH_TOKEN });
    if (!r?.access_token) throw new Error("فشل التجديد: " + JSON.stringify(r).slice(0, 300));
    ACCESS_TOKEN = r.access_token;
    console.error("[auth] ⚠️ حدّث Secrets يدويًا: ALIEXPRESS_ACCESS_TOKEN, REFRESH_TOKEN, TOKEN_EXPIRES_AT");
  }
}

async function callAliExpress(extraParams) {
  if (!APP_KEY || !APP_SECRET) throw new Error("ALIEXPRESS_APP_KEY / ALIEXPRESS_APP_SECRET غير موجودين");
  await ensureToken();

  const data = await callSync(extraParams);
  const err = data?.error_response ?? (data?.code !== undefined && String(data.code) !== "0" && data.code ? data : null);
  if (err) throw new Error(`AliExpress API error ${err.code}: ${err.message ?? err.msg ?? JSON.stringify(data).slice(0, 300)}`);

  const root = data?.aliexpress_affiliate_product_query_response?.resp_result?.result
            ?? data?.aliexpress_affiliate_product_query_response?.result
            ?? data?.resp_result?.result
            ?? data;

  // الاستجابة قد تكون products.product (مصفوفة) أو products مباشرة
  const rawProducts = root?.products?.product ?? root?.products ?? root?.result ?? [];
  const products = Array.isArray(rawProducts) ? rawProducts : [];
  const totalRecordCount = Number(root?.total_record_count ?? root?.total_results ?? products.length);

  if (!products.length) throw new Error(`AliExpress empty response: ${JSON.stringify(data).slice(0, 500)}`);
  return { products, totalRecordCount };
}

/**
 * يجلب منتجات AliExpress بكلمة بحث، ويحوّلها لنفس شكل عناصر فيد علي بابا.
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
      console.error(`AliExpress "${keywords}" page ${page}: ${products.length} products (total ${totalRecordCount})`);
    } catch (e) {
      console.error(`AliExpress fetch failed (keywords="${keywords}", page=${page}): ${e.message}`);
      break;
    }

    if (!products.length) break;

    for (const p of products) {
      const images = p.product_small_image_urls?.string ?? p.product_image_urls?.string ?? [];
      items.push({
        id: "aex-" + (p.product_id ?? Math.random().toString(36).slice(2)),
        title: p.product_title || p.subject || "",
        title_ar: "",
        description_ar: "",
        price: Number(p.app_sale_price ?? p.target_sale_price ?? p.original_price ?? 0) || 0,
        currency: p.app_sale_price_currency || p.target_sale_price_currency || "USD",
        image: images[0] || p.product_main_image_url || "",
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
