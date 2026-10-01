import { getText } from "../lib/http.mjs";

const tag = (xml, name) => {
  const m = xml.match(new RegExp(`<(?:\\w+:)?${name}[^>]*>([\\s\\S]*?)</(?:\\w+:)?${name}>`, "i"));
  return m ? m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, "").trim() : undefined;
};

/** RSS / Atom / Google Merchant XML. */
export async function fetchRaw(company) {
  const xml = await getText(company.url, company.headers);
  const blocks = xml.match(/<(item|entry)[\s>][\s\S]*?<\/(item|entry)>/gi) ?? [];
  return blocks.map((b) => ({
    id: tag(b, "id") ?? tag(b, "guid"),
    title: tag(b, "title"),
    description: tag(b, "description"),
    price: tag(b, "sale_price") ?? tag(b, "price"),
    compare_at_price: tag(b, "sale_price") ? tag(b, "price") : undefined,
    url: tag(b, "link") ?? b.match(/<link[^>]*href="([^"]+)"/i)?.[1],
    image: tag(b, "image_link") ?? b.match(/<enclosure[^>]*url="([^"]+)"/i)?.[1],
    category: tag(b, "product_type") ?? tag(b, "category"),
  }));
}
