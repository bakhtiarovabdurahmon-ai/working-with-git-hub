import Product from '../models/Product.js';
import ProductStock from '../models/ProductStock.js';

// Карточка автоматически прячется из каталога (но не удаляется), как только
// суммарный остаток по ней у всех магазинов доходит до нуля — и снова
// появляется сама, как только у кого-то на складе опять есть хотя бы одна
// штука. Вызывается после любого изменения стока (продажа, заказ,
// пополнение, присоединение/удаление магазина).
export async function refreshArchiveStatus(productId) {
  const stocks = await ProductStock.find({ productId, active: true });
  const totalQty = stocks.reduce((sum, s) => sum + s.sizes.reduce((a, sz) => a + sz.qty, 0), 0);
  await Product.findByIdAndUpdate(productId, { archived: totalQty === 0 });
}
