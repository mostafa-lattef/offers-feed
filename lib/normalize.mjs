import { classify } from "./classify.mjs";

const num = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/[^0-9.,-]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};
const pick = (o, names) => { for (const n of names) if (o[n] !== undefined && o[n] !== null && o[n] !== "") return o[n]; return undefined; };

const DEFAULT_FIELDS = {
  id: ["id", "sku", "product_id", "productId", "external_id", "guid", "link", "url"],
  title: ["title", "name", "name_en", "product_title", "subject"],
  title_ar: ["title_ar", "name_ar"],
  description: ["description", "description_en", "summary"],
  price: ["price", "sale_price", "offer_price", "app_sale_price", "target_sale_price"],
  compare_at_price: ["compare_at_price", "old_price", "list_price", "was_price", "original_price"],
  currency: ["currency", "price_currency"],
  image: ["image", "image_url", "thumbnail", "image_link", "imageUrl", "product_main_image_url"],
  url: ["url", "link", "deep_link", "promotion_link", "product_detail_url", "affiliateUrl"],
  category: ["category", "category_name", "product_type", "first_level_category_name"],
};

/** يحوّل عنصراً خاماً من أي شركة إلى الشكل الموحد، أو null إذا كان غير صالح. */
export function normalizeItem(raw, company, taxonomy) {
  const f = company.fields ?? {};
  const get = (k) => {
    if (f[k]) return raw[f[k]];
    return pick(raw, DEFAULT_FIELDS[k]);
  };
  const title = String(get("title") ?? "").trim();
  const url = String(get("url") ?? "").trim();
  const rawId = get("id");
  if (!title || !url || rawId === undefined) return null;

  let image = get("image");
  if (Array.isArray(image)) image = image[0];
  const price = num(get("price")) ?? 0;
  const compare = num(get("compare_at_price"));
  const rawCategory = String(get("category") ?? "").trim();
  const category_key = classify(taxonomy, { rawCategory, title, categoryMap: company.categoryMap });

  return {
    id: `${company.id}-${String(rawId).slice(0, 160)}`,
    company: company.id,
    title,
    title_ar: String(get("title_ar") ?? "").trim(),
    description: get("description") ? String(get("description")).slice(0, 1000) : "",
    price,
    compare_at_price: compare && compare > price ? compare : null,
    currency: String(get("currency") ?? company.currency ?? "USD").toUpperCase().slice(0, 8),
    image: image ? String(image) : "",
    url,
    category: rawCategory || "General",
    category_key,
    is_real: true,
  };
}
