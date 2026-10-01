import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadSecretsIntoEnv, interpolate } from "./lib/env.mjs";
import { loadTaxonomy } from "./lib/classify.mjs";
import { normalizeItem } from "./lib/normalize.mjs";
import { loadAdapter } from "./adapters/index.mjs";

const ROOT = new URL("../", import.meta.url);
const rootDir = fileURLToPath(ROOT);
loadSecretsIntoEnv();

async function loadCompanies() {
  const dir = path.join(rootDir, "companies");
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".json") && !f.startsWith("_"));
  const out = [];
  for (const f of files.sort()) {
    const c = JSON.parse(await fs.readFile(path.join(dir, f), "utf8"));
    c.id ||= f.replace(/\.json$/, "");
    if (!/^[a-z0-9][a-z0-9-]*$/.test(c.id)) { console.error(`تخطي ${f}: المعرّف "${c.id}" يجب أن يكون حروفاً صغيرة/أرقاماً/شرطات.`); continue; }
    if (c.enabled === false) { console.log(`⏭  ${c.id}: معطّلة`); continue; }
    out.push(c);
  }
  return out;
}

async function main() {
  const cfg = JSON.parse(await fs.readFile(path.join(rootDir, "feed.config.json"), "utf8"));
  const taxonomy = await loadTaxonomy(ROOT);
  const companies = await loadCompanies();
  console.log(`🚀 الشركات المفعّلة: ${companies.length}`);

  const items = [], seen = new Set(), report = [];
  for (const raw of companies) {
    const company = interpolate(raw);
    const stat = { company: company.id, fetched: 0, kept: 0, skipped: 0, error: null };
    try {
      const adapter = await loadAdapter(company.type);
      const rows = await adapter.fetchRaw(company);
      stat.fetched = rows.length;
      let kept = 0;
      for (const r of rows) {
        if (kept >= (company.limit ?? cfg.maxItemsPerCompany)) break;
        const item = normalizeItem(r, company, taxonomy);
        if (!item || seen.has(item.id) || (!item.category_key && !cfg.keepUncategorized)) { stat.skipped++; continue; }
        seen.add(item.id); items.push(item); kept++;
      }
      stat.kept = kept;
    } catch (e) {
      stat.error = e.message;
      console.error(`❌ ${company.id}: ${e.message}`);
    }
    report.push(stat);
  }

  // توزيع على التصنيفات: سقف لكل تصنيف حتى لا يطغى تصنيف واحد على البقية
  const perCat = new Map(), final = [];
  for (const it of items) {
    const k = it.category_key ?? "_none";
    const n = perCat.get(k) ?? 0;
    if (n >= cfg.maxItemsPerCategory) continue;
    perCat.set(k, n + 1); final.push(it);
  }

  const feed = {
    generated_at: new Date().toISOString(),
    companies: companies.map((c) => ({ ok: !report.find((r) => r.company === c.id)?.error, count: final.filter((i) => i.company === c.id).length, id: c.id, name: c.name ?? c.id, name_ar: c.name_ar ?? c.name ?? c.id, url: c.site_url ?? null, logo: c.logo ?? null, currency: c.currency ?? "USD" })),
    taxonomy: taxonomy.map(({ key, name_en, name_ar }) => ({ key, name_en, name_ar })),
    items: final,
  };
  await fs.writeFile(path.join(rootDir, "feed.json"), JSON.stringify(feed, null, 2) + "\n");

  console.table(report);
  console.log(`✅ feed.json: ${final.length} معروض (${companies.length} شركة)`);
  // فشل كل الشركات المفعّلة يُعتبر فشلاً للتشغيل حتى لا يُستبدل الفيد السابق بفيد فارغ بالخطأ
  if (companies.length > 0 && report.every((r) => r.error)) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
