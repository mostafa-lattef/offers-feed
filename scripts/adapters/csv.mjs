import { getText, readLocal } from "../lib/http.mjs";

function parseCsv(text) {
  const rows = []; let row = [], cur = "", q = false;
  const s = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"' && s[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(cur); cur = "";
      if (row.some((x) => x !== "")) rows.push(row);
      row = [];
    } else cur += c;
  }
  if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

/** CSV برأس الأعمدة في السطر الأول: من رابط (url) أو من ملف/مجلد داخل المستودع (path). */
export async function fetchRaw(company) {
  const texts = company.path ? await readLocal(company.path, ".csv") : [await getText(company.url, company.headers)];
  const out = [];
  for (const text of texts) {
    const [head, ...rest] = parseCsv(text);
    if (!head) continue;
    for (const r of rest) out.push(Object.fromEntries(head.map((h, i) => [h.trim(), r[i] ?? ""])));
  }
  return out;
}
