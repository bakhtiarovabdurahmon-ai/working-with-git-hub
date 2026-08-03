// Демо-поток оплаты: реквизиты + QR-заглушка → загрузка квитанции → имитация проверки → чек.
// ВНИМАНИЕ: это симуляция для учебного проекта. Реальная приёмка платежей, сверка
// квитанций и печать фискального чека требуют регистрации бизнеса и интеграции
// с платёжным провайдером/онлайн-кассой (54-ФЗ) — здесь этого нет и быть не может.

import { useEffect, useMemo, useRef, useState } from 'react';
import { formatPrice } from '../store.jsx';

const DEMO_RECIPIENT = {
  phone: '755 311172',
  name: 'ИП Демонстрационный (тест)',
};

function seededQr(n) {
  return Math.abs((Math.sin(n * 12.9898) * 43758.5453) % 1);
}

function QrMock({ seed }) {
  const cells = [];
  for (let i = 0; i < 121; i++) {
    cells.push(seededQr(seed + i) > 0.52);
  }
  return (
    <div className="qr-mock">
      {cells.map((on, i) => (
        <span key={i} className={on ? 'on' : ''} />
      ))}
    </div>
  );
}

export default function PaymentModal({ items, cart, total, onClose, onDone }) {
  const [step, setStep] = useState('details');
  const [receiptFileName, setReceiptFileName] = useState(null);
  const [toast, setToast] = useState(null);
  const verifyTimer = useRef(null);
  const toastTimer = useRef(null);

  const order = useMemo(
    () => ({
      id: 'WB-' + Math.floor(100000 + Math.random() * 900000),
      date: new Date(),
    }),
    []
  );

  useEffect(() => {
    return () => {
      clearTimeout(verifyTimer.current);
      clearTimeout(toastTimer.current);
    };
  }, []);

  function showToast(msg) {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1400);
  }

  function copy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    showToast('Скопировано: ' + text);
  }

  function handleFileChange(e) {
    const file = e.target.files && e.target.files[0];
    if (file) setReceiptFileName(file.name);
  }

  function sendToVerification() {
    setStep('verifying');
    clearTimeout(verifyTimer.current);
    verifyTimer.current = setTimeout(() => setStep('confirmed'), 1600);
  }

  return (
    <div className="pay-backdrop open" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pay-modal">
        <button className="pay-close-btn" type="button" onClick={onClose}>✕</button>

        {step === 'details' ? (
          <>
            <div className="pay-eyebrow">Оплата заказа {order.id}</div>
            <h2 className="pay-title">Переведите по реквизитам</h2>
            <span className="pay-demo-flag">⚠ Демо-режим: проверка перевода имитируется, банк не подключён</span>
            <div className="pay-amount">
              <div className="pay-amount-label">Сумма к оплате</div>
              <div className="pay-amount-value">{formatPrice(total)}</div>
            </div>
            <QrMock seed={order.id.length + 3} />
            <div className="qr-note">QR — иллюстративная заглушка (не привязан к банку/СБП)</div>
            <div className="pay-row">
              <div>
                <div className="pay-row-k">Телефон получателя</div>
                <div className="pay-row-v">{DEMO_RECIPIENT.phone}</div>
              </div>
              <button className="pay-copy-btn" type="button" onClick={() => copy(DEMO_RECIPIENT.phone)}>Скопировать</button>
            </div>
            <div className="pay-row">
              <div>
                <div className="pay-row-k">Получатель</div>
                <div className="pay-row-v">{DEMO_RECIPIENT.name}</div>
              </div>
            </div>
            <button
              className="btn btn-primary btn-large"
              style={{ width: '100%', marginTop: 18 }}
              type="button"
              onClick={() => setStep('upload')}
            >
              Я перевёл(а) — прикрепить квитанцию
            </button>
            <button className="pay-ghost-btn" type="button" onClick={onClose}>Отменить</button>
          </>
        ) : null}

        {step === 'upload' ? (
          <>
            <div className="pay-eyebrow">Оплата заказа {order.id}</div>
            <h2 className="pay-title">Прикрепите квитанцию</h2>
            <p className="pay-sub">
              Загрузите скриншот или PDF подтверждения перевода — система (в демо-режиме) проверит его автоматически.
            </p>
            <label className={`pay-upload-box ${receiptFileName ? 'has-file' : ''}`}>
              <span className="pay-upload-icon">📎</span>
              <span>{receiptFileName ? '✓ ' + receiptFileName : 'Нажмите, чтобы выбрать файл'}</span>
              <input type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={handleFileChange} />
            </label>
            <button
              className="btn btn-primary btn-large"
              style={{ width: '100%' }}
              type="button"
              disabled={!receiptFileName}
              onClick={sendToVerification}
            >
              Отправить на проверку
            </button>
            <button className="pay-ghost-btn" type="button" onClick={() => setStep('details')}>
              Назад к реквизитам
            </button>
          </>
        ) : null}

        {step === 'verifying' ? (
          <>
            <div className="pay-spinner" />
            <div className="pay-status-text">Проверяем квитанцию…</div>
            <div className="pay-status-sub">Демо-режим: реальная сверка с банком не выполняется</div>
          </>
        ) : null}

        {step === 'confirmed' ? (
          <>
            <div className="pay-success-badge">✓</div>
            <h2 className="pay-title" style={{ textAlign: 'center' }}>Квитанция подтверждена</h2>
            <p className="pay-sub" style={{ textAlign: 'center' }}>
              Чек сформирован и отправлен в мобильное приложение (демо-симуляция кассы).
            </p>
            <div className="pay-receipt-box">
              <div className="pay-receipt-line"><span>Заказ</span><span>{order.id}</span></div>
              <div className="pay-receipt-line"><span>Дата</span><span>{order.date.toLocaleString('ru-RU')}</span></div>
              <div className="pay-receipt-line"><span>Файл квитанции</span><span>{receiptFileName || '—'}</span></div>
              {items.map((p) => (
                <div className="pay-receipt-line" key={p.id}>
                  <span>{p.title} × {cart[p.id]}</span>
                  <span>{formatPrice(p.price * cart[p.id])}</span>
                </div>
              ))}
              <div className="pay-receipt-line total"><span>Итого</span><span>{formatPrice(total)}</span></div>
            </div>
            <button className="btn btn-primary btn-large" style={{ width: '100%' }} type="button" onClick={onDone}>
              Готово
            </button>
          </>
        ) : null}
      </div>
      {toast ? <div className="pay-toast show">{toast}</div> : null}
    </div>
  );
}
