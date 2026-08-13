import { Router } from 'express';
import Order from '../models/Order.js';
import User from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { sendOrderNotification } from '../lib/mailer.js';

const router = Router();

function genOrderNumber() {
  return 'OP-' + Math.floor(100000 + Math.random() * 900000);
}

function isStaff(user) {
  return user.role === 'admin' || user.role === 'superadmin';
}

// Покупатель отправляет корзину — сервер группирует товары по продавцу
// (у каждого товара уже проставлен sellerEmail при добавлении, см.
// server/routes/products.js) и создаёт по одному заказу на продавца, чтобы
// каждый магазин видел только свои позиции.
router.post('/', requireAuth, async (req, res) => {
  try {
    const { items, fulfillment } = req.body;
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'Корзина пуста' });
    if (!['delivery', 'reserve'].includes(fulfillment)) return res.status(400).json({ error: 'Укажите способ получения' });

    const groups = new Map();
    for (const it of items) {
      const price = Number(it.price);
      const qty = Number(it.qty);
      if (!it.productId || !it.title || !Number.isFinite(price) || price <= 0 || !Number.isFinite(qty) || qty <= 0) {
        return res.status(400).json({ error: 'Некорректный товар в заказе' });
      }
      const key = it.sellerEmail || '__store__';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({ productId: it.productId, title: it.title, price, qty });
    }

    const created = [];
    for (const [key, groupItems] of groups) {
      const sellerEmail = key === '__store__' ? null : key;
      const total = groupItems.reduce((sum, it) => sum + it.price * it.qty, 0);
      const order = await Order.create({
        orderNumber: genOrderNumber(),
        buyerEmail: req.user.email,
        buyerName: req.user.name,
        sellerEmail,
        items: groupItems,
        total,
        fulfillment,
      });
      created.push(order);

      // Лучшее старание, не блокирует создание заказа при сбое почты.
      const notifyEmail = sellerEmail || (await User.findOne({ role: 'superadmin' }))?.email;
      if (notifyEmail) {
        sendOrderNotification(notifyEmail, order).catch(() => {});
      }
    }

    res.status(201).json(created.map((o) => o.toJSON()));
  } catch (err) {
    res.status(400).json({ error: 'Не удалось оформить заказ' });
  }
});

// Заказы текущего пользователя: как покупателя (asBuyer) и, если он
// продавец/админ, как продавца (asSeller). Admin/superadmin как продавец
// видят вообще все заказы — им нужно и подтверждать оплату, и подстраховывать
// продавцов.
router.get('/mine', requireAuth, async (req, res) => {
  const asBuyer = await Order.find({ buyerEmail: req.user.email }).sort({ createdAt: -1 });

  let asSeller = [];
  if (isStaff(req.user)) {
    asSeller = await Order.find({}).sort({ createdAt: -1 });
  } else if (req.user.role === 'seller') {
    asSeller = await Order.find({ sellerEmail: req.user.email }).sort({ createdAt: -1 });
  }

  res.json({
    asBuyer: asBuyer.map((o) => o.toJSON()),
    asSeller: asSeller.map((o) => o.toJSON()),
  });
});

// Продавец (или admin/superadmin) подтверждает, есть ли товар в наличии.
router.patch('/:id/stock', requireAuth, async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ error: 'Заказ не найден' });
  if (!isStaff(req.user) && order.sellerEmail !== req.user.email) {
    return res.status(403).json({ error: 'Это не ваш заказ' });
  }
  if (order.status !== 'pending_stock') return res.status(400).json({ error: 'Заказ уже обработан' });

  order.status = req.body.inStock ? 'awaiting_payment' : 'out_of_stock';
  await order.save();
  res.json(order.toJSON());
});

// Покупатель отмечает "я перевёл(а)" — только по своему заказу.
router.patch('/:id/receipt', requireAuth, async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ error: 'Заказ не найден' });
  if (order.buyerEmail !== req.user.email) return res.status(403).json({ error: 'Это не ваш заказ' });
  if (order.status !== 'awaiting_payment') return res.status(400).json({ error: 'Заказ не ожидает оплаты' });

  order.status = 'payment_review';
  order.receiptFileName = (req.body.receiptFileName || '').toString().slice(0, 200);
  await order.save();
  res.json(order.toJSON());
});

// Только супер админ подтверждает реальное поступление перевода — деньги
// приходят на его личные реквизиты вне зависимости от того, чей это товар.
router.patch('/:id/confirm-payment', requireAuth, async (req, res) => {
  if (req.user.role !== 'superadmin') return res.status(403).json({ error: 'Подтверждать оплату может только супер админ' });

  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ error: 'Заказ не найден' });
  if (order.status !== 'payment_review') return res.status(400).json({ error: 'Заказ не ожидает подтверждения оплаты' });

  order.status = 'completed';
  await order.save();
  res.json(order.toJSON());
});

export default router;
