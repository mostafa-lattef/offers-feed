import { normalizeProduct } from './base.adapter.js';

export async function fetchAliExpressProducts() {
  try {
    // هنا يتم وضع الكود الفعلي أو جلب البيانات من الـ API أو الملفات المؤقتة لديك
    // مثال تمثيلي لبيانات مستخرجة:
    const rawProducts = [
      // استبدل هذا لاحقاً بالبيانات الحقيقية التي يجلبها سكربتك القديم
    ];

    console.log("✔ تم جلب منتجات AliExpress بنجاح.");
    return rawProducts.map(item => normalizeProduct(item, 'aliexpress'));
  } catch (error) {
    console.error("❌ خطأ في محول AliExpress:", error.message);
    return [];
  }
}
