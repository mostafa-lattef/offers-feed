import crypto from "node:crypto";

// ===== AliExpress Open Platform (Affiliate API) =====
const clean = (v) => (v || "").replace(/\s+/g, "");
const APP_KEY = clean(process.env.ALIEXPRESS_APP_KEY);
const APP_SECRET = clean(process.env.ALIEXPRESS_APP_SECRET);
const TRACKING_ID = clean(process.env.ALIEXPRESS_TRACKING_ID) || "default";
let ACCESS_TOKEN = clean(process.env.ALIEXPRESS_ACCESS_TOKEN);
const REFRESH_TOKEN = clean(process.env.ALIEXPRESS_REFRESH_TOKEN);
const TOKEN_EXPIRES_AT = Number(process.env.ALIEXPRESS_TOKEN_EXPIRES_AT || 0);

const SYNC_URL = "https://api-sg.aliexpress.com/sync";   // بروتوكول TOP للمنتجات
const REST_URL = "https://api-sg.aliexpress.com/rest";   // بروتوكول GOP للتوكنات
const METHOD = "aliexpress.affiliate.product.query";

console.error(`[debug] APP_KEY preview: ${APP_KEY?.slice(0, 4)}… len=${APP_KEY?.length}`);
console.error(`[debug] APP_SECRET len=${APP_SECRET?.length}`);
console.error(`[debug] ACCESS_TOKEN len=${ACCESS_TOKEN?.length}`);

// التوقيع الرسمي المثبت من IopUtils: apiName + البارامترات المرتّبة (key+value)
const hmacUpper = (s) => crypto.createHmac("sha256", APP_SECRET).update(s, "utf8").digest("hex").toUpperCase();
function signFor(apiName, params) {
  let s = apiName;
  for (const k of Object.keys(params).sort()) {
    const v = params[k];
    if (v != null && v !== "") s += k + v;
  }
  return hmacUpper(s);
}

async function getJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`AliExpress HTTP ${res.status}`);
  return res.json();
}

// نداء REST (التوكنات): /rest + apiName — التركيبة الفائزة المثبتة
async function callRest(apiName, biz) {
  const params = { app_key: APP_KEY, sign_method: "sha256", timestamp: String(Date.now()), ...biz };
  const url = `${REST_URL}${apiName}?` + new URLSearchParams({ ...params, sign: signFor(apiName, params) }).toString();
  return getJson(url);
}

// نداء TOP (المنتجات): /sync — يُحسم أمر method داخل البصمة تلقائيًا
let METHOD_IN_SIGN = true;
async function callSync(apiName, biz) {
  const params = {
    app_key: APP_KEY, method: apiName, sign_method: "sha256",
    timestamp: String(Date.now()), access_token: ACCESS_TOKEN, ...biz,
  };
  const forSign = METHOD_IN_SIGN
    ? params
    : Object.fromEntries(Object.entries(params).filter(([k]) => k !== "method"));
  const url = `${SYNC_URL}?` + new URLSearchParams({ ...params, sign: signFor(apiName, forSign) }).toString();
  return getJson(url);
}

// تجديد التوكن عند الانتهاء (لهذه الجولة فقط + تنبيه لتحديث الأسرار)
async function ensureToken() {
  if (!ACCESS_TOKEN) throw new Error("ALIEXPRESS_ACCESS_TOKEN غير موجود في Secrets");
  if (TOKEN_EXPIRES_AT && Date.now() > TOKEN_EXPIRES_AT - 3600_000) {
    if (!REFRESH_TOKEN) throw new Error("التوكن منتهٍ وALIEXPRESS_REFRESH_TOKEN غير موجود");
    console.error("[auth] التوكن منتهٍ — تجديد لهذه الجولة فقط…");
    const r = await callRest("/auth/token/refresh", { refresh_token: REFRESH_TOKEN });
    if (!r?.access_token) throw new Error("فشل التجديد: " + JSON.stringify(r).slice(0, 300));
    ACCESS_TOKEN = r.access_token;
    console.error("[auth] ⚠️ نجحت الجولة بتوكن مؤقت — حدّث الأسرار عبر scripts/refresh-token.mjs");
  }
  return ACCESS_TOKEN;
}

async function callAliExpress(extraParams) {
  if (!APP_KEY || !APP_SECRET) throw new Error("ALIEXPRESS_APP_KEY / ALIEXPRESS_APP_SECRET غير موجودين");
  await ensureToken();

  for (const methodInSign of [true, false]) {
    METHOD_IN_SIGN = methodInSign;
    const data = await callSync(METHOD, extraParams);

    const err = data?.error_response ?? (data?.code !== undefined && String(data.code) !== "0" ? data : null);
    if (err) {
      if (err.code === "IncompleteSignature") continue;   // جرّب التركيبة الأخرى
      throw new Error(`AliExpress API error ${err.code}: ${err.message ?? err.msg ?? JSON.stringify(data).slice(0, 300)}`);
    }

    const r = data?.aliexpress_affiliate_product_query_response ?? data?.resp_result ?? data;
    const products = Array.isArray(r?.result?.products) ? r.result.products
      : Array.isArray(r?.products) ? r.products
      : Array.isArray(r?.result) ? r.result : [];
    const totalRecordCount = Number(r?.result?.total_results ?? r?.total_results ?? products.length);

    if (!products.length) throw new Error(`AliExpress empty/unexpected response: ${JSON.stringify(data).slice(0, 500)}`);
    console.error(`[auth] ✅ تركيبة التوقيع الفائزة: methodInSign=${methodInSign}`);
    return { products, totalRecordCount };
  }
  throw new Error("IncompleteSignature بكل التركيبات — تحقق من الأسرار");
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
    } catch (e) {
      console.error(`AliExpress fetch failed (keywords="${keywords}", page=${page}): ${e.message}`);
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
