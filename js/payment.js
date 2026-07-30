// Демо-поток оплаты: реквизиты + QR-заглушка → загрузка квитанции → имитация проверки → чек.
// ВНИМАНИЕ: это симуляция для учебного проекта. Реальная приёмка платежей, сверка
// квитанций и печать фискального чека требуют регистрации бизнеса и интеграции
// с платёжным провайдером/онлайн-кассой (54-ФЗ) — здесь этого нет и быть не может.

const DEMO_RECIPIENT = {
  phone: '+7 900 000-00-00',
  card: '2200 0000 0000 0000',
  name: 'ИП Демонстрационный (тест)',
};

let paymentOrder = null;
let receiptFileName = null;
let verifyTimer = null;

function seededQr(n) {
  return Math.abs((Math.sin(n * 12.9898) * 43758.5453) % 1);
}

function qrMockHtml(seed) {
  let cells = '';
  for (let i = 0; i < 121; i++) {
    const on = seededQr(seed + i) > 0.52;
    cells += `<span class="${on ? 'on' : ''}"></span>`;
  }
  return cells;
}

function cartTotal() {
  const cart = getCart();
  return Object.keys(cart).reduce((sum, id) => sum + getProductById(id).price * cart[id], 0);
}

function openPayment() {
  const cart = getCart();
  if (!Object.keys(cart).length) return;
  paymentOrder = {
    id: 'WB-' + Math.floor(100000 + Math.random() * 900000),
    total: cartTotal(),
    items: Object.keys(cart).map((id) => ({ p: getProductById(id), qty: cart[id] })),
    date: new Date(),
  };
  receiptFileName = null;
  renderPaymentStep('details');
  document.getElementById('pay-backdrop').classList.add('open');
}

function closePayment() {
  document.getElementById('pay-backdrop').classList.remove('open');
  clearTimeout(verifyTimer);
}

function bindPayCommon() {
  const closeBtn = document.getElementById('pay-close');
  if (closeBtn) closeBtn.addEventListener('click', closePayment);
}

function renderPaymentStep(step) {
  const root = document.getElementById('pay-content');

  if (step === 'details') {
    root.innerHTML = `
      <button class="pay-close-btn" id="pay-close">✕</button>
      <div class="pay-eyebrow">Оплата заказа ${paymentOrder.id}</div>
      <h2 class="pay-title">Переведите по реквизитам</h2>
      <span class="pay-demo-flag">⚠ Демо-реквизиты, не для реальных переводов</span>
      <div class="pay-amount">
        <div class="pay-amount-label">Сумма к оплате</div>
        <div class="pay-amount-value">${formatPrice(paymentOrder.total)}</div>
      </div>
      <div class="qr-mock">${qrMockHtml(paymentOrder.id.length + 3)}</div>
      <div class="qr-note">QR — иллюстративная заглушка (не привязан к банку/СБП)</div>
      <div class="pay-row">
        <div><div class="pay-row-k">Телефон получателя</div><div class="pay-row-v">${DEMO_RECIPIENT.phone}</div></div>
        <button class="pay-copy-btn" data-copy="${DEMO_RECIPIENT.phone}">Скопировать</button>
      </div>
      <div class="pay-row">
        <div><div class="pay-row-k">Номер карты</div><div class="pay-row-v">${DEMO_RECIPIENT.card}</div></div>
        <button class="pay-copy-btn" data-copy="${DEMO_RECIPIENT.card}">Скопировать</button>
      </div>
      <div class="pay-row">
        <div><div class="pay-row-k">Получатель</div><div class="pay-row-v">${DEMO_RECIPIENT.name}</div></div>
      </div>
      <button class="btn btn-primary btn-large" id="pay-to-upload" style="width:100%;margin-top:18px">Я перевёл(а) — прикрепить квитанцию</button>
      <button class="pay-ghost-btn" id="pay-cancel">Отменить</button>
    `;
    bindPayCommon();
    root.querySelectorAll('[data-copy]').forEach((b) =>
      b.addEventListener('click', () => {
        const text = b.getAttribute('data-copy');
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).catch(() => {});
        showPayToast('Скопировано: ' + text);
      })
    );
    document.getElementById('pay-to-upload').addEventListener('click', () => renderPaymentStep('upload'));
    document.getElementById('pay-cancel').addEventListener('click', closePayment);
  }

  if (step === 'upload') {
    root.innerHTML = `
      <button class="pay-close-btn" id="pay-close">✕</button>
      <div class="pay-eyebrow">Оплата заказа ${paymentOrder.id}</div>
      <h2 class="pay-title">Прикрепите квитанцию</h2>
      <p class="pay-sub">Загрузите скриншот или PDF подтверждения перевода — система (в демо-режиме) проверит его автоматически.</p>
      <label class="pay-upload-box" id="upload-box">
        <span class="pay-upload-icon">📎</span>
        <span id="upload-label">Нажмите, чтобы выбрать файл</span>
        <input type="file" id="receipt-input" accept="image/*,.pdf" style="display:none" />
      </label>
      <button class="btn btn-primary btn-large" id="pay-send-receipt" style="width:100%" disabled>Отправить на проверку</button>
      <button class="pay-ghost-btn" id="pay-back-details">Назад к реквизитам</button>
    `;
    bindPayCommon();
    const box = document.getElementById('upload-box');
    const input = document.getElementById('receipt-input');
    const sendBtn = document.getElementById('pay-send-receipt');
    input.addEventListener('change', () => {
      if (input.files && input.files[0]) {
        receiptFileName = input.files[0].name;
        document.getElementById('upload-label').textContent = '✓ ' + receiptFileName;
        box.classList.add('has-file');
        sendBtn.disabled = false;
      }
    });
    sendBtn.addEventListener('click', () => renderPaymentStep('verifying'));
    document.getElementById('pay-back-details').addEventListener('click', () => renderPaymentStep('details'));
  }

  if (step === 'verifying') {
    root.innerHTML = `
      <div class="pay-spinner"></div>
      <div class="pay-status-text">Проверяем квитанцию…</div>
      <div class="pay-status-sub">Демо-режим: реальная сверка с банком не выполняется</div>
    `;
    clearTimeout(verifyTimer);
    verifyTimer = setTimeout(() => renderPaymentStep('confirmed'), 1600);
  }

  if (step === 'confirmed') {
    const itemsHtml = paymentOrder.items
      .map(({ p, qty }) => `<div class="pay-receipt-line"><span>${escapeHtml(p.title)} × ${qty}</span><span>${formatPrice(p.price * qty)}</span></div>`)
      .join('');
    root.innerHTML = `
      <button class="pay-close-btn" id="pay-close">✕</button>
      <div class="pay-success-badge">✓</div>
      <h2 class="pay-title" style="text-align:center">Квитанция подтверждена</h2>
      <p class="pay-sub" style="text-align:center">Чек сформирован и отправлен в мобильное приложение (демо-симуляция кассы).</p>
      <div class="pay-receipt-box">
        <div class="pay-receipt-line"><span>Заказ</span><span>${paymentOrder.id}</span></div>
        <div class="pay-receipt-line"><span>Дата</span><span>${paymentOrder.date.toLocaleString('ru-RU')}</span></div>
        <div class="pay-receipt-line"><span>Файл квитанции</span><span>${receiptFileName || '—'}</span></div>
        ${itemsHtml}
        <div class="pay-receipt-line total"><span>Итого</span><span>${formatPrice(paymentOrder.total)}</span></div>
      </div>
      <button class="btn btn-primary btn-large" id="pay-done" style="width:100%">Готово</button>
    `;
    bindPayCommon();
    document.getElementById('pay-done').addEventListener('click', () => {
      writeStore(CART_KEY, {});
      updateHeaderCounters();
      closePayment();
      if (typeof onPaymentDone === 'function') onPaymentDone();
    });
  }
}

function showPayToast(msg) {
  let el = document.getElementById('pay-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'pay-toast';
    el.className = 'pay-toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(showPayToast._t);
  showPayToast._t = setTimeout(() => el.classList.remove('show'), 1400);
}

document.addEventListener('DOMContentLoaded', () => {
  const backdrop = document.getElementById('pay-backdrop');
  if (!backdrop) return;
  backdrop.addEventListener('click', (e) => {
    if (e.target.id === 'pay-backdrop') closePayment();
  });
  const checkoutBtn = document.getElementById('checkout-btn');
  if (checkoutBtn) checkoutBtn.addEventListener('click', openPayment);
});
