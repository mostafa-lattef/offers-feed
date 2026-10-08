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

  // حالة التدوير: مؤشر لكل شركة/تصنيف يتقدّم مع كل تشغيل، فيأخذ التشغيل التالي الدفعة التالية
  const statePath = path.join(rootDir, "rotation-state.json");
  const state = JSON.parse(await fs.readFile(statePath, "utf8").catch(() => "{}"));

  const items = [], seen = new Set(), report = [];
  for (const raw of companies) {
    const company = interpolate(raw);
    const stat = { company: company.id, fetched: 0, kept: 0, skipped: 0, error: null };
    try {
      const adapter = await loadAdapter(company.type);
      const st = (state[company.id] ??= { cats: {}, page: 0 });
      company._page = st.page; // للمحوّلات التي تقرأ صفحات (API)
      const rows = await adapter.fetchRaw(company);
      stat.fetched = rows.length;
      const catCap = company.maxPerCategory ?? cfg.maxItemsPerCompanyCategory ?? 150;
      const rotate = company.rotate ?? cfg.rotate ?? true;
      const step = company.rotateStep ?? cfg.rotateStep ?? catCap;
      const limit = company.limit ?? cfg.maxItemsPerCompany;

      // 1) تطبيع كل الصفوف وتجميعها حسب التصنيف (بالترتيب الأصلي: الملف الأول ثم الثاني…)
      const groups = new Map();
      for (const r of rows) {
        const item = normalizeItem(r, company, taxonomy);
        if (!item || (!item.category_key && !cfg.keepUncategorized)) { stat.skipped++; continue; }
        const ck = item.category_key ?? "_none";
        (groups.get(ck) ?? groups.set(ck, []).get(ck)).push(item);
      }

      // 2) من كل تصنيف: نافذة بحجم السقف تبدأ من المؤشر المحفوظ ثم يتقدّم المؤشر
      let kept = 0;
      for (const [ck, list] of groups) {
        const n = list.length;
        const start = rotate ? (st.cats[ck] ?? 0) % n : 0;
        const take = Math.min(catCap, n);
        for (let i = 0; i < take && kept < limit; i++) {
          const item = list[(start + i) % n];
          if (seen.has(item.id)) { stat.skipped++; continue; }
          seen.add(item.id); items.push(item); kept++;
        }
        if (rotate) st.cats[ck] = (start + Math.min(step, n)) % n;
      }
      if (rotate) st.page = (st.page ?? 0) + 1;
      stat.kept = kept;
    } catch (e) {
      stat.error = e.message;
      console.error(`❌ ${company.id}: ${e.message}`);
    }
    report.push(stat);
  }

  // توزيع على التصنيفات: سقف لكل تصنيف حتى لا يطغى تصنيف واحد على البقية
  const perCatTotal = new Map(), final = [];
  for (const it of items) {
    const k = it.category_key ?? "_none";
    const n = perCatTotal.get(k) ?? 0;
    if (n >= cfg.maxItemsPerCategory) continue;
    perCatTotal.set(k, n + 1); final.push(it);
  }

  const feed = {
    generated_at: new Date().toISOString(),
    companies: companies.map((c) => ({ ok: !report.find((r) => r.company === c.id)?.error, count: final.filter((i) => i.company === c.id).length, id: c.id, name: c.name ?? c.id, name_ar: c.name_ar ?? c.name ?? c.id, url: c.site_url ?? null, logo: c.logo ?? null, currency: c.currency ?? "USD" })),
    taxonomy: taxonomy.malls.map(({ key, name_en, name_ar, departments }) => ({ key, name_en, name_ar, departments: departments.map(({ key, name_en, name_ar }) => ({ key, name_en, name_ar })) })),
    items: final,
  };
  await fs.writeFile(statePath, JSON.stringify(state, null, 2) + "\n");
  await fs.writeFile(path.join(rootDir, "feed.json"), JSON.stringify(feed, null, 2) + "\n");

  console.table(report);
  console.log(`✅ feed.json: ${final.length} معروض (${companies.length} شركة)`);
  // فشل كل الشركات المفعّلة يُعتبر فشلاً للتشغيل حتى لا يُستبدل الفيد السابق بفيد فارغ بالخطأ
  if (companies.length > 0 && report.every((r) => r.error)) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
