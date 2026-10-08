export async function getText(url, headers = {}, timeoutMs = 30000) {
  const res = await fetch(url, {
    headers: { "user-agent": "offers-feed/2.0 (+mercora)", accept: "*/*", ...headers },
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} من ${new URL(url).host}`);
  return res.text();
}

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** مصدر محلي داخل المستودع: ملف واحد، أو مجلد (كل ملفات الامتداد المطلوب فيه). */
export async function readLocal(rel, ext) {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const full = path.resolve(root, rel);
  if (!full.startsWith(root)) throw new Error("مسار غير مسموح");
  const st = await fs.stat(full).catch(() => null);
  if (!st) throw new Error(`المسار غير موجود: ${rel}`);
  const files = st.isDirectory()
    ? (await fs.readdir(full)).filter((f) => f.toLowerCase().endsWith(ext)).sort().map((f) => path.join(full, f))
    : [full];
  const texts = [];
  for (const f of files) texts.push(await fs.readFile(f, "utf8"));
  return texts;
}
