import { Router } from 'express';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import ProductStock from '../models/ProductStock.js';
import User from '../models/User.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { sendOrderNotification } from '../lib/mailer.js';
import { rateLimit } from '../middleware/rateLimit.js';

const router = Router();
// Caps order-creation spam (each order emails the shop) — keyed per
// authenticated user, applied after requireAuth so req.user is set.
const createOrderLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 30, keyFn: (req) => req.user.email });

function genOrderNumber() {
  return 'OP-' + Math.floor(100000 + Math.random() * 900000);
}

function isStaff(user) {
  return user.role === 'admin' || user.role === 'superadmin';
}

// "На смене" ли хоть кто-то, кто может выдать этот сток — если сток привязан
// к магазину, достаточно ОДНОГО сотрудника магазина на смене (коллеги
// подстраховывают друг друга), если продавец без магазина — только он сам.
async function isStockOnShift(stock) {
  if (stock.shopId) {
    const anyOnShift = await User.exists({ shopId: stock.shopId, onShift: true });
    return !!anyOnShift;
  }
  const seller = await User.findOne({ email: stock.sellerEmail });
  return !!seller?.onShift;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Покупатель отправляет корзину (товар + выбранный размер) — для каждой
// позиции сервер сам ищет, у какого магазина есть этот размер в наличии И
// чей продавец сейчас на смене, и маршрутизирует туда случайно (если
// подходит несколько). Один и тот же товар в двух заказах может уйти в
// разные магазины — это и есть смысл общей карточки на несколько магазинов
// (см. server/models/ProductStock.js).
router.post('/', requireAuth, createOrderLimiter, async (req, res) => {
  // Списанное здесь возвращаем назад, если позже в этой же корзине что-то
  // сорвётся — без этого неудачный чек-аут мог бы навсегда потерять единицы
  // товара, которые так и не попали ни в один заказ.
  const committed = []; // { stockId, size, qty }
  async function rollback() {
    for (const c of committed) {
      // eslint-disable-next-line no-await-in-loop
      await ProductStock.updateOne({ _id: c.stockId, 'sizes.size': c.size }, { $inc: { 'sizes.$.qty': c.qty } }).catch(() => {});
    }
  }

  try {
    const { items, fulfillment } = req.body;
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'Корзина пуста' });
    if (!['delivery', 'reserve'].includes(fulfillment)) return res.status(400).json({ error: 'Укажите способ получения' });

    const address = String(req.body.address || '').trim().slice(0, 300);
    if (fulfillment === 'delivery' && !address) {
      return res.status(400).json({ error: 'Укажите адрес доставки' });
    }
    for (const it of items) {
      const qty = Number(it.qty);
      if (!it.productId || !String(it.size || '').trim() || !Number.isFinite(qty) || qty <= 0) {
        return res.status(400).json({ error: 'Некорректный товар в заказе' });
      }
    }

    // key -> { stock, items: [] } — группируем позиции корзины по тому,
    // какая стоковая строка (магазин/продавец) их в итоге обслужит.
    const groups = new Map();

    for (const it of items) {
      const qty = Number(it.qty);
      const size = String(it.size).trim();

      let product;
      try {
        // eslint-disable-next-line no-await-in-loop
        product = await Product.findById(it.productId);
      } catch (e) {
        product = null;
      }
      if (!product) {
        await rollback();
        return res.status(400).json({ error: 'Товар в корзине больше не найден' });
      }

      // eslint-disable-next-line no-await-in-loop
      const candidates = await ProductStock.find({
        productId: product._id,
        active: true,
        sizes: { $elemMatch: { size, qty: { $gte: qty } } },
      });
      if (candidates.length === 0) {
        await rollback();
        return res.status(400).json({ error: `«${product.title}», размер ${size} — сейчас нет в наличии` });
      }

      const eligible = [];
      for (const stock of candidates) {
        // eslint-disable-next-line no-await-in-loop
        if (await isStockOnShift(stock)) eligible.push(stock);
      }
      if (eligible.length === 0) {
        await rollback();
        return res
          .status(400)
          .json({ error: 'Извините, наши сотрудники сейчас не работают. Пожалуйста, попробуйте позже.' });
      }

      // Списываем атомарно и сразу — findOneAndUpdate с условием на qty в
      // фильтре не даст двум одновременным заказам увести последнюю
      // единицу дважды. Перебираем случайно перемешанных кандидатов, пока
      // кто-то не спишется успешно (мог проиграть гонку другому заказу).
      let chosen = null;
      for (const candidate of shuffle(eligible)) {
        // eslint-disable-next-line no-await-in-loop
        const updated = await ProductStock.findOneAndUpdate(
          { _id: candidate._id, sizes: { $elemMatch: { size, qty: { $gte: qty } } } },
          { $inc: { 'sizes.$.qty': -qty } }
        );
        if (updated) {
          chosen = candidate;
          break;
        }
      }
      if (!chosen) {
        await rollback();
        return res.status(400).json({ error: `«${product.title}», размер ${size} — только что разобрали, попробуйте ещё раз` });
      }
      committed.push({ stockId: chosen._id, size, qty });

      const key = String(chosen._id);
      if (!groups.has(key)) groups.set(key, { stock: chosen, items: [] });
      groups.get(key).items.push({ productId: String(product._id), title: product.title, price: product.price, qty, size });
    }

    const created = [];
    for (const group of groups.values()) {
      const total = group.items.reduce((sum, it) => sum + it.price * it.qty, 0);
      // eslint-disable-next-line no-await-in-loop
      const order = await Order.create({
        orderNumber: genOrderNumber(),
        buyerEmail: req.user.email,
        buyerName: req.user.name,
        sellerEmail: group.stock.sellerEmail,
        shopId: group.stock.shopId,
        items: group.items,
        total,
        fulfillment,
        deliveryAddress: fulfillment === 'delivery' ? address : null,
      });
      created.push(order);

      // Лучшее старание, не блокирует создание заказа при сбое почты.
      let notifyEmails = [];
      if (group.stock.shopId) {
        // eslint-disable-next-line no-await-in-loop
        const members = await User.find({ shopId: group.stock.shopId });
        notifyEmails = members.map((m) => m.email);
      } else {
        notifyEmails = [group.stock.sellerEmail];
      }
      notifyEmails.forEach((email) => sendOrderNotification(email, order).catch(() => {}));
    }

    res.status(201).json(created.map((o) => o.toJSON()));
  } catch (err) {
    await rollback();
    res.status(400).json({ error: 'Не удалось оформить заказ' });
  }
});

// Заказы текущего пользователя: как покупателя (asBuyer) и, если он
// продавец/админ, как продавца (asSeller). Продавец в магазине видит все
// заказы своего магазина (их могли добавить коллеги). Admin/superadmin как
// продавец видят вообще все заказы — им нужно и подтверждать оплату, и
// подстраховывать продавцов.
router.get('/mine', requireAuth, async (req, res) => {
  const asBuyer = await Order.find({ buyerEmail: req.user.email }).sort({ createdAt: -1 });

  let asSeller = [];
  if (isStaff(req.user)) {
    asSeller = await Order.find({}).sort({ createdAt: -1 });
  } else if (req.user.role === 'seller' && req.user.shopId) {
    asSeller = await Order.find({ shopId: req.user.shopId }).sort({ createdAt: -1 });
  } else if (req.user.role === 'seller') {
    asSeller = await Order.find({ sellerEmail: req.user.email }).sort({ createdAt: -1 });
  }

  res.json({
    asBuyer: asBuyer.map((o) => o.toJSON()),
    asSeller: asSeller.map((o) => o.toJSON()),
  });
});

function canManage(user, order) {
  if (isStaff(user)) return true;
  if (user.shopId && order.shopId && String(order.shopId) === String(user.shopId)) return true;
  return order.sellerEmail === user.email;
}

// Продавец (или коллега по магазину, или admin/superadmin) подтверждает,
// есть ли товар в наличии.
router.patch('/:id/stock', requireAuth, async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ error: 'Заказ не найден' });
  if (!canManage(req.user, order)) return res.status(403).json({ error: 'Это не ваш заказ' });
  if (order.status !== 'pending_stock') return res.status(400).json({ error: 'Заказ уже обработан' });

  const inStock = !!req.body.inStock;
  order.status = inStock ? 'awaiting_payment' : 'out_of_stock';

  await order.save();
  res.json(order.toJSON());
});

// Покупатель отмечает "я перевёл(а)" — только по своему заказу.
router.patch('/:id/receipt', requireAuth, async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ error: 'Заказ не найден' });
  if (order.buyerEmail !== req.user.email) return res.status(403).json({ error: 'Это не ваш заказ' });
  if (order.status !== 'awaiting_payment') return res.status(400).json({ error: 'Заказ не ожидает оплаты' });

  const receiptImage = (req.body.receiptImage || '').toString();
  if (!receiptImage.startsWith('data:image/')) {
    return res.status(400).json({ error: 'Прикрепите фото квитанции' });
  }
  if (receiptImage.length > 4_000_000) {
    return res.status(400).json({ error: 'Фото слишком большое, выберите поменьше' });
  }

  order.status = 'payment_review';
  order.receiptFileName = (req.body.receiptFileName || '').toString().slice(0, 200);
  order.receiptImage = receiptImage;
  await order.save();
  res.json(order.toJSON());
});

// Деньги всегда приходят на личные реквизиты супер админа, но подтвердить
// перевод (по фото квитанции) может и сам продавец/коллега по магазину —
// кто первый увидел и подтвердил, тот и подтвердил, заказ сразу закрывается.
router.patch('/:id/confirm-payment', requireAuth, async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ error: 'Заказ не найден' });
  if (!canManage(req.user, order)) return res.status(403).json({ error: 'Это не ваш заказ' });
  if (order.status !== 'payment_review') return res.status(400).json({ error: 'Заказ не ожидает подтверждения оплаты' });

  order.status = 'completed';
  await order.save();
  res.json(order.toJSON());
});

const COMMISSION_RATE = 0.15;

// Дневной отчёт для супер админа: сумма завершённых заказов за день и 15%
// комиссии сайта с неё. ?date=YYYY-MM-DD, по умолчанию сегодня (UTC).
router.get('/report', requireAuth, requireRole('superadmin'), async (req, res) => {
  const dateStr = String(req.query.date || new Date().toISOString().slice(0, 10));
  const start = new Date(dateStr + 'T00:00:00.000Z');
  if (Number.isNaN(start.getTime())) return res.status(400).json({ error: 'Некорректная дата' });
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  const orders = await Order.find({ status: 'completed', updatedAt: { $gte: start, $lt: end } });
  const totalSales = orders.reduce((sum, o) => sum + o.total, 0);

  res.json({
    date: dateStr,
    ordersCount: orders.length,
    totalSales,
    commissionRate: COMMISSION_RATE,
    commission: Math.round(totalSales * COMMISSION_RATE),
  });
});

export default router;
