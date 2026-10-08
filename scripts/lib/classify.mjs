import fs from "node:fs/promises";

/** يحمّل المولات الثمانية وأقسامها + خريطة التصنيفات الأصلية (category-map.json). */
export async function loadTaxonomy(root) {
  const malls = JSON.parse(await fs.readFile(new URL("taxonomy.json", root), "utf8"));
  const map = JSON.parse(await fs.readFile(new URL("category-map.json", root), "utf8").catch(() => "{}"));
  return { malls, map };
}

const norm = (s) => ` ${String(s ?? "").toLowerCase().replace(/[^a-z0-9\u0600-\u06ff&' ]+/g, " ").replace(/\s+/g, " ").trim()}`;

function bestDepartment(tax, text, onlyMall = null) {
  const hay = norm(text);
  let best = null, bestScore = 0;
  for (const m of tax.malls) {
    if (onlyMall && m.key !== onlyMall) continue;
    for (const d of m.departments) {
      let s = 0;
      for (const kw of d.keywords ?? []) if (hay.includes(` ${kw.trim().toLowerCase()}`)) s += kw.trim().length;
      if (s > bestScore) { best = { mall: m.key, department: d.key }; bestScore = s; }
    }
  }
  return best;
}

const deptOf = (tax, mall, dept) => tax.malls.find((m) => m.key === mall)?.departments.some((d) => d.key === dept);

/**
 * يحدد { mall, department } للمنتج (أو null) بالترتيب:
 * 1) categoryMap الخاص بالشركة: "الاسم الخام": "mall" أو "mall/department"
 * 2) خريطة MERCORA الرسمية category-map.json (بالاسم الأصلي)
 * 3) كلمات الأقسام المفتاحية في اسم التصنيف الخام ثم في العنوان
 * `hintMall` (من محوّل يعرف المول) يثبّت المول ويحدد القسم من العنوان.
 */
export function classify(tax, { rawCategory, title, categoryMap = {}, hintMall = null }) {
  const raw = String(rawCategory ?? "").trim();
  const low = raw.toLowerCase();

  if (hintMall && tax.malls.some((m) => m.key === hintMall)) {
    const viaMap = tax.map[low];
    if (viaMap?.mall === hintMall) return viaMap;
    return { mall: hintMall, department: bestDepartment(tax, `${raw} ${title}`, hintMall)?.department ?? null };
  }

  const co = categoryMap[raw] ?? categoryMap[low];
  if (co) {
    const [mall, dept] = String(co).split("/");
    if (tax.malls.some((m) => m.key === mall)) {
      const fromMap = tax.map[low];
      return { mall, department: dept && deptOf(tax, mall, dept) ? dept : fromMap?.mall === mall ? fromMap.department : bestDepartment(tax, `${raw} ${title}`, mall)?.department ?? null };
    }
  }
  if (tax.malls.some((m) => m.key === raw)) return { mall: raw, department: null };
  if (tax.map[low]) return tax.map[low];
  return (raw && bestDepartment(tax, raw)) || bestDepartment(tax, title) || null;
}
