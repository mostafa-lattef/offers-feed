import { getText } from "../lib/http.mjs";

/** فيد JSON: مصفوفة، أو كائن فيه items / products / offers (أو المسار في listPath). */
export async function fetchRaw(company) {
  const data = JSON.parse(await getText(company.url, company.headers));
  if (company.listPath) {
    return company.listPath.split(".").reduce((o, k) => o?.[k], data) ?? [];
  }
  if (Array.isArray(data)) return data;
  return data.items ?? data.products ?? data.offers ?? [];
}
