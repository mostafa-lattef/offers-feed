import crypto from "node:crypto";

// AliExpress Open Platform (Affiliate API). الأسرار من البيئة؛ بادئتها تُغيَّر بـ company.envPrefix
// (الافتراضي ALIEXPRESS_) فيمكن إضافة أكثر من حساب.
const SYNC_URL = "https://api-sg.aliexpress.com/sync";
const REST_URL = "https://api-sg.aliexpress.com/rest";
const METHOD = "aliexpress.affiliate.product.query";

const clean = (v) => (v || "").replace(/\s+/g, "");
const chinaTime = () => new Date(Date.now() + 8 * 3600e3).toISOString().replace("T", " ").substring(0, 19);

function makeClient(prefix) {
  const env = (n) => clean(process.env[prefix + n]);
  const c = {
    key: env("APP_KEY"), secret: env("APP_SECRET"), tracking: env("TRACKING_ID") || "default",
    token: env("ACCESS_TOKEN"), refresh: env("REFRESH_TOKEN"), expiresAt: Number(env("TOKEN_EXPIRES_AT") || 0),
  };
  const hmac = (s) => crypto.createHmac("sha256", c.secret).update(s, "utf8").digest("hex").toUpperCase();
  const signTop = (p) => hmac(Object.keys(p).sort().reduce((s, k) => (p[k] != null && p[k] !== "" ? s + k + p[k] : s), ""));

  async function ensureToken() {
    if (!c.key || !c.secret) throw new Error(`${prefix}APP_KEY / ${prefix}APP_SECRET غير موجودين`);
    if (!c.token) throw new Error(`${prefix}ACCESS_TOKEN غير موجود`);
    if (c.expiresAt && Date.now() > c.expiresAt - 3600_000) {
      if (!c.refresh) throw new Error(`التوكن منتهٍ و${prefix}REFRESH_TOKEN غير موجود`);
      const params = { app_key: c.key, sign_method: "sha256", timestamp: String(Date.now()), refresh_token: c.refresh };
      const apiName = "/auth/token/refresh";
      const sign = hmac(Object.keys(params).sort().reduce((s, k) => s + k + params[k], apiName));
      const res = await fetch(`${REST_URL}${apiName}?` + new URLSearchParams({ ...params, sign }), { signal: AbortSignal.timeout(30000) });
      const r = await res.json();
      if (!r?.access_token) throw new Error("فشل تجديد التوكن: " + JSON.stringify(r).slice(0, 200));
      c.token = r.access_token;
      console.error(`[auth] جُدّد التوكن لهذه الجولة فقط — حدّث أسرار ${prefix}* يدوياً.`);
    }
  }

  async function query(biz) {
    await ensureToken();
    const common = {
      app_key: c.key, method: METHOD, v: "2.0", format: "json", timestamp: chinaTime(),
      sign_method: "sha256", partner_id: "iop-node-sdk", session: c.token, ...biz,
    };
    const url = `${SYNC_URL}?` + new URLSearchParams({ ...common, sign: signTop(common) });
    const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw new Error(`AliExpress HTTP ${res.status}`);
    const data = await res.json();
    const err = data?.error_response ?? (data?.code && String(data.code) !== "0" ? data : null);
    if (err) throw new Error(`AliExpress ${err.code}: ${err.message ?? err.msg ?? ""}`.slice(0, 300));
    const root = data?.aliexpress_affiliate_product_query_response?.resp_result?.result ?? data;
    const raw = root?.products?.product ?? root?.products ?? [];
    return { products: Array.isArray(raw) ? raw : [], total: Number(root?.total_record_count ?? 0) };
  }
  return { query, tracking: c.tracking };
}

export async function fetchRaw(company) {
  const client = makeClient(company.envPrefix ?? "ALIEXPRESS_");
  // كل كلمة: نص، أو { "q": "...", "category": "<مفتاح التصنيف>" } لتثبيت تصنيف النتائج
  const keywords = (company.keywords?.length ? company.keywords : ["trending"]).map((k) => (typeof k === "string" ? { q: k } : k));
  const maxPages = company.maxPages ?? 2, pageSize = company.pageSize ?? 50;
  const rotatePages = company.rotatePages ?? 6; // كل تشغيل يبدأ من صفحة تالية، ثم يعود للأولى
  const firstPage = ((company._page ?? 0) % rotatePages) * maxPages + 1;
  const out = [];
  for (const { q: kw, category: hint } of keywords) {
    for (let page = firstPage; page < firstPage + maxPages; page++) {
      const { products, total } = await client.query({
        keywords: kw, page_no: page, page_size: pageSize,
        target_currency: company.currency ?? "USD", target_language: "EN", tracking_id: client.tracking,
      });
      if (!products.length) break;
      for (const p of products) {
        const imgs = p.product_small_image_urls?.string ?? p.product_image_urls?.string ?? [];
        out.push({
          id: p.product_id,
          title: p.product_title,
          price: p.app_sale_price ?? p.target_sale_price ?? p.original_price,
          compare_at_price: p.original_price,
          currency: p.target_sale_price_currency ?? p.app_sale_price_currency,
          image: imgs[0] ?? p.product_main_image_url,
          url: p.promotion_link ?? p.product_detail_url,
          category: p.second_level_category_name ?? p.first_level_category_name,
          category_hint: hint,
        });
      }
      if (page * pageSize >= total) break;
    }
  }
  return out;
}
