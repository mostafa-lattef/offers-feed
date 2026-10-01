// لإضافة نوع جديد من المصادر: أنشئ ملفاً في هذا المجلد يصدّر fetchRaw(company)
// ثم استخدم اسم الملف في حقل "type" داخل ملف الشركة. لا حاجة لتعديل أي كود آخر.
export async function loadAdapter(type) {
  if (!/^[a-z0-9-]+$/.test(type ?? "")) throw new Error(`نوع مصدر غير صالح: ${type}`);
  try {
    return await import(`./${type}.mjs`);
  } catch (e) {
    if (e.code === "ERR_MODULE_NOT_FOUND") throw new Error(`لا يوجد محوّل للنوع "${type}" (scripts/adapters/${type}.mjs)`);
    throw e;
  }
}
