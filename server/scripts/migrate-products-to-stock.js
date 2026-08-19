// Разовый скрипт миграции: раньше у каждого Product были свои sellerEmail/
// shopId/qty/inStock прямо на карточке (один продавец = одна карточка).
// Теперь Product — это общая карточка, а сток каждого магазина живёт
// отдельно в ProductStock (см. server/models/ProductStock.js), чтобы
// несколько магазинов могли торговать одним и тем же товаром.
//
// Этот скрипт переносит уже существующие в базе товары: для каждого
// Product со старым sellerEmail (и без уже созданного ProductStock —
// скрипт безопасно перезапускать) создаётся одна стоковая строка с тем же
// продавцом/магазином. У старой карточки был только ОБЩИЙ qty на все
// размеры сразу (без разбивки по размеру) — миграция ставит это же
// количество на КАЖДЫЙ размер, какие были у товара. Это грубое
// приближение (может завысить реальный остаток по отдельным размерам) —
// после миграции стоит зайти и поправить точные остатки вручную.
//
// Запуск на сервере: node server/scripts/migrate-products-to-stock.js

import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../db.js';
import ProductStock from '../models/ProductStock.js';
import { generateUniqueCode } from '../lib/codes.js';

async function run() {
  await connectDB();

  // Мы читаем сырые документы напрямую из коллекции, а не через модель
  // Product — у новой схемы уже нет полей sellerEmail/shopId/qty/inStock,
  // Mongoose их просто не увидит, а нам нужны именно старые значения.
  const rawProducts = await mongoose.connection.collection('products').find({}).toArray();

  let migrated = 0;
  let skippedNoSeller = 0;
  let skippedAlready = 0;

  for (const raw of rawProducts) {
    if (!raw.sellerEmail) {
      skippedNoSeller += 1;
      continue;
    }

    // eslint-disable-next-line no-await-in-loop
    const already = await ProductStock.findOne({ productId: raw._id, sellerEmail: raw.sellerEmail });
    if (already) {
      skippedAlready += 1;
      continue;
    }

    const sizes = Array.isArray(raw.sizes) ? raw.sizes : [];
    const qty = Number(raw.qty) || 0;
    if (sizes.length === 0 || qty <= 0) {
      skippedNoSeller += 1;
      continue;
    }

    // eslint-disable-next-line no-await-in-loop
    const code = await generateUniqueCode(ProductStock);
    // eslint-disable-next-line no-await-in-loop
    await ProductStock.create({
      productId: raw._id,
      sellerEmail: raw.sellerEmail,
      shopId: raw.shopId || null,
      code,
      sizes: sizes.map((size) => ({ size, qty })),
    });
    migrated += 1;
    console.log(`✓ ${raw.title} — сток для ${raw.sellerEmail} создан (код ${code}), ${sizes.length} размер(ов) × ${qty}`);
  }

  console.log('');
  console.log(`Готово. Перенесено: ${migrated}. Пропущено (уже перенесено): ${skippedAlready}. Пропущено (нет продавца/размеров/остатка): ${skippedNoSeller}.`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Ошибка миграции:', err);
  process.exit(1);
});
