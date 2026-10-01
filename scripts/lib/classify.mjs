import fs from "node:fs/promises";

export async function loadTaxonomy(root) {
  return JSON.parse(await fs.readFile(new URL("taxonomy.json", root), "utf8"));
}

const norm = (s) => ` ${String(s ?? "").toLowerCase().replace(/[^a-z0-9\u0600-\u06ff& ]+/g, " ").replace(/\s+/g, " ").trim()} `;

/**
 * يحدد التصنيف الرئيسي للمنتج:
 * 1) categoryMap الخاص بالشركة  2) تطابق اسم التصنيف الخام بالكلمات المفتاحية  3) تطابق العنوان.
 */
export function classify(taxonomy, { rawCategory, title, categoryMap = {} }) {
  const raw = String(rawCategory ?? "").trim();
  const mapped = categoryMap[raw] ?? categoryMap[raw.toLowerCase()];
  if (mapped && taxonomy.some((t) => t.key === mapped)) return mapped;
  if (raw && taxonomy.some((t) => t.key === raw)) return raw;

  const score = (text) => {
    const hay = norm(text);
    let best = null, bestScore = 0;
    for (const t of taxonomy) {
      let s = 0;
      for (const kw of t.keywords ?? []) if (hay.includes(` ${kw.trim().toLowerCase()}`)) s += kw.trim().length;
      if (s > bestScore) { best = t.key; bestScore = s; }
    }
    return best;
  };
  return (raw && score(raw)) || score(title) || null;
}
