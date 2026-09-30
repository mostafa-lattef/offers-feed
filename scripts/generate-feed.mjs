import fs from 'fs/promises';
import path from 'path';
import config from './config/affiliates.config.json' assert { type: 'json' };

import { fetchAliExpressProducts } from './adapters/aliexpress.adapter.js';
import { fetchAlibabaProducts } from './adapters/alibaba.adapter.js';

const adapters = {
  aliexpress: fetchAliExpressProducts,
  alibaba: fetchAlibabaProducts
};

async function buildMasterFeed() {
  let masterFeed = [];

  console.log("🚀 بدء عملية تحديث الفيد العالمي لموقع ميركورا...");

  for (const provider of config.providers) {
    if (!provider.enabled || !provider.isGlobal) {
      console.log(`⚠️ تخطي المنصة: ${provider.name} (غير مفعلة أو مقيدة).`);
      continue;
    }

    if (adapters[provider.name]) {
      try {
        console.log(`📥 جاري جلب المنتجات من: ${provider.name}...`);
        const products = await adapters[provider.name]();
        masterFeed.push(...products);
      } catch (error) {
        console.error(`❌ فشل الجلب من ${provider.name}:`, error.message);
      }
    }
  }

  const outputPath = path.resolve('./public/feed.json');
  await fs.writeFile(outputPath, JSON.stringify(masterFeed, null, 2));
  console.log(`✅ تم تحديث ملف الفيد بنجاح! إجمالي المنتجات المعتمَدة: ${masterFeed.length}`);
}

buildMasterFeed();
