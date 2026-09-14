import crypto from "node:crypto";

// ===== AliExpress Open Platform (Affiliate API) =====
// المفاتيح تُقرأ من متغيرات البيئة فقط — لا يوجد أي قيمة افتراضية هنا أبداً.
// إذا لم تكن موجودة، الدالة تفشل بوضوح بدل ما تعمل بمفتاح مكشوف داخل الكود.
const APP_KEY = process.env.ALIEXPRESS_APP_KEY;
const APP_SECRET = process.env.ALIEXPRESS_APP_SECRET;
const TRACKING_ID = process.env.ALIEXPRESS_TRACKING_ID || "default";

// ملاحظة مهمة: تطبيقات "Affiliates API" (زي تطبيقك) مسجّلة على بوابة
// Taobao/TOP القديمة، مش على api-sg.aliexpress.com. وكل الأمثلة الموثّقة
// لنفس الـmethod بتستخدم http (مش https) لهذا الدومين تحديداً — استخدام
// https هنا سبّب فشل الاتصال (fetch failed) بسبب مشكلة في شهادة/بروتوكول TLS.
const API_URL = "http://gw.api.taobao.com/router/rest";
const METHOD = "aliexpress.affiliate.product.query";

// توقيع TOP: MD5(APP_SECRET + مفاتيح_مرتّبة+قيمها + APP_SECRET) بالحروف الكبيرة
function generateSignature(params, appSecret) {
  const sortedKeys = Object.keys(params).sort();
  let s = appSecret;
  for (const key of sortedKeys) {
    if (params[key] !== undefined && params[key] !== null && params[key] !== "") {
      s += `${key}${params[key]}`;
    }
  }
  s += appSecret;
  return crypto.createHash("md5").update(s, "utf8").digest("hex").toUpperCase();
}

// التوقيت الزمني مطلوب بصيغة "yyyy-MM-dd HH:mm:ss" بتوقيت الصين (GMT+8) —
// استخدام وقت UTC مباشرة هنا كان بيولّد فارق 8 ساعات وممكن يخلي السيرفر يرفض
// الطلب باعتباره توقيتاً غير صالح.
function chinaTimestamp() {
  const chinaMs = Date.now() + 8 * 60 * 60 * 1000;
  return new Date(chinaMs).toISOString().replace("T", " ").substring(0, 19);
}

async function callAliExpress(extraParams) {
  if (!APP_KEY || !APP_SECRET) {
    throw new Error("ALIEXPRESS_APP_KEY / ALIEXPRESS_APP_SECRET غير موجودين في متغيرات البيئة");
  }

  const params = {
    app_key: APP_KEY,
    method: METHOD,
    format: "json",
    v: "2.0",
    sign_method: "md5",
    timestamp: chinaTimestamp(),
    tracking_id: TRACKING_ID,
    target_currency: "USD", // نفس عملة باقي الفيد؛ الترجمة/التوطين تتم لاحقاً من لوحة الأدمن
    target_language: "EN",
    page_size: 50,
    ...extraParams,
  };

  params.sign = generateSignature(params, APP_SECRET);

  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
    signal: AbortSignal.timeout(20000),
  });

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
