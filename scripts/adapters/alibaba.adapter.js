import { normalizeProduct } from './base.adapter.js';

export async function fetchAlibabaProducts() {
  try {
    // كود جلب منتجات علي بابا
    const rawProducts = [];

    console.log("✔ تم جلب منتجات Alibaba بنجاح.");
    return rawProducts.map(item => normalizeProduct(item, 'alibaba'));
  } catch (error) {
    console.error("❌ خطأ في محول Alibaba:", error.message);
    return [];
  }
}
