import { Router } from 'express';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import User from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
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

// Покупатель отправляет корзину — сервер группирует товары по магазину
// (у каждого товара уже проставлен shopId при добавлении, см.
// server/routes/products.js; если продавец не в магазине — группируем по
// нему лично) и создаёт по одному заказу на магазин/продавца, чтобы каждый
// видел только свои позиции.
router.post('/', requireAuth, createOrderLimiter, async (req, res) => {
  try {
    const { items, fulfillment } = req.body;
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'Корзина пуста' });
    if (!['delivery', 'reserve'].includes(fulfillment)) return res.status(400).json({ error: 'Укажите способ получения' });

    // Price, title, seller and shop all come from the Product record in the
    // database, never from the client — otherwise a tampered request could
    // set an arbitrary price or route the order to the wrong shop.
    const groups = new Map();
    for (const it of items) {
      const qty = Number(it.qty);
      if (!it.productId || !Number.isFinite(qty) || qty <= 0) {
        return res.status(400).json({ error: 'Некорректный товар в заказе' });
      }
      let product;
      try {
        product = await Product.findById(it.productId);
      } catch (e) {
        product = null;
      }
      if (!product) return res.status(400).json({ error: 'Товар в корзине больше не найден' });

      const shopId = product.shopId ? String(product.shopId) : null;
      const sellerEmail = product.sellerEmail || null;
      const key = shopId || sellerEmail || '__store__';
      if (!groups.has(key)) groups.set(key, { shopId, sellerEmail, items: [] });
      groups.get(key).items.push({ productId: String(product._id), title: product.title, price: product.price, qty });
    }

    const created = [];
    for (const group of groups.values()) {
      const total = group.items.reduce((sum, it) => sum + it.price * it.qty, 0);
      const order = await Order.create({
        orderNumber: genOrderNumber(),
        buyerEmail: req.user.email,
        buyerName: req.user.name,
        sellerEmail: group.sellerEmail,
        shopId: group.shopId,
        items: group.items,
        total,
        fulfillment,
      });
      created.push(order);

      // Лучшее старание, не блокирует создание заказа при сбое почты.
      let notifyEmails = [];
      if (group.shopId) {
        const members = await User.find({ shopId: group.shopId });
        notifyEmails = members.map((m) => m.email);
      } else if (group.sellerEmail) {
        notifyEmails = [group.sellerEmail];
      } else {
        const superadmin = await User.findOne({ role: 'superadmin' });
        if (superadmin) notifyEmails = [superadmin.email];
      }
      notifyEmails.forEach((email) => sendOrderNotification(email, order).catch(() => {}));
    }

    res.status(201).json(created.map((o) => o.toJSON()));
  } catch (err) {
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

  // Продавец может сразу начислить покупателю кешбек за этот заказ.
  if (inStock) {
    const cashbackNum = Number(req.body.cashback) || 0;
    if (cashbackNum > 0) {
      order.cashbackAwarded = cashbackNum;
      await User.findOneAndUpdate({ email: order.buyerEmail }, { $inc: { cashback: cashbackNum } });
    }
  }

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
