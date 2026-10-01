// يدمج أسرار GitHub (SECRETS_JSON) في process.env دون استبدال ما هو موجود،
// فيمكنك إضافة سرّ لأي شركة جديدة دون تعديل ملف الـ workflow.
export function loadSecretsIntoEnv() {
  const raw = process.env.SECRETS_JSON;
  if (!raw) return;
  try {
    for (const [k, v] of Object.entries(JSON.parse(raw))) {
      if (typeof v === "string" && v && process.env[k] === undefined) process.env[k] = v;
    }
  } catch {
    /* ignore malformed */
  }
}

/** يستبدل ${NAME} بقيمة متغير البيئة (داخل النصوص والكائنات). */
export function interpolate(value) {
  if (typeof value === "string") return value.replace(/\$\{([A-Z0-9_]+)\}/g, (_, n) => process.env[n] ?? "");
  if (Array.isArray(value)) return value.map(interpolate);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, interpolate(v)]));
  return value;
}
