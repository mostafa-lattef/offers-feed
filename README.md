# offers-feed

مولّد فيد المعروضات لموقع **MERCORA**. لا يرتبط بأي شركة بعينها: كل شركة = ملف JSON صغير داخل `companies/`.
عند أول تشغيل (بلا أي شركة) الناتج **0 معروضات**.

## إضافة شركة (في أي وقت)
1. انسخ `companies/_template.json` إلى `companies/<اسم-الشركة>.json` وعدّل القيم.
2. (اختياري) أضف أي مفاتيح سرية كـ GitHub Secrets، وأشِر إليها في الملف بصيغة `${اسم_السر}` — لا حاجة لتعديل الـ workflow.
3. شغّل **Update Offers Feed** يدوياً أو انتظر الجدولة (كل 12 ساعة).

لإيقاف شركة مؤقتاً: `"enabled": false`. لحذفها: احذف ملفها. (المعروضات تُسحب من الموقع في المزامنة التالية.)

## أنواع المصادر (`type`)
| type | المصدر | أهم الحقول |
|---|---|---|
| `json` | فيد JSON (مصفوفة أو `items/products/offers`) | `url`, `headers`, `listPath`, `fields` |
| `csv` | ملف CSV برأس أعمدة | `url`, `headers`, `fields` |
| `xml` | RSS / Atom / Google Merchant | `url`, `headers` |
| `aliexpress-affiliate` | AliExpress Affiliate API | `keywords`, `maxPages`, `envPrefix` (أسرار `ALIEXPRESS_*`) |

مصدر من نوع آخر؟ أنشئ `scripts/adapters/<type>.mjs` يصدّر `fetchRaw(company)` ويُرجع مصفوفة عناصر خام، ثم استخدم `<type>` في ملف الشركة.

### ربط الحقول `fields`
إن لم تتطابق أسماء حقول المصدر مع الشائعة (`id, title, price, image, url, category, …`) فاربطها:
`"fields": { "id": "sku", "title": "name", "image": "img", "url": "link", "category": "type" }`

## التصنيفات (أساس توزيع الأبراج في MERCORA)
كل معروض يحصل على `category_key` من `taxonomy.json` (10 تصنيفات رئيسية) بالترتيب:
1. `categoryMap` في ملف الشركة، مثل `{ "gadgets": "consumer_electronics" }`
2. الكلمات المفتاحية في اسم التصنيف الخام ثم في عنوان المنتج.

ما لا يُصنَّف يُستبعد (إلا إن ضبطت `keepUncategorized: true` في `feed.config.json`).
`maxItemsPerCategory` يضع سقفاً لكل تصنيف كي لا يطغى تصنيف واحد، و`maxItemsPerCompany` سقفاً لكل شركة.

## شكل `feed.json`
```json
{ "generated_at": "…", "companies": [{ "id", "name", "name_ar", "ok", "count" }],
  "taxonomy": [{ "key", "name_en", "name_ar" }],
  "items": [{ "id", "company", "title", "price", "currency", "image", "url", "category", "category_key" }] }
```
`companies[].ok = false` تعني فشل سحب تلك الشركة في هذه الجولة؛ MERCORA لا يسحب معروضاتها القديمة في هذه الحالة.

## الأسرار
`SITE_URL` و`OFFERS_SYNC_TOKEN` (لإبلاغ MERCORA بعد كل تحديث) + أسرار الشركات التي تحتاجها.
