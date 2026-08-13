// Поток оплаты подтверждённого заказа: реквизиты → загрузка квитанции →
// отметка "я перевёл(а)" → дальше супер админ вручную сверяет перевод и
// подтверждает его в разделе «Заказы» (см. src/orders.jsx, PATCH
// /api/orders/:id/confirm-payment на сервере). Проверка квитанции ниже —
// это просто анимация ожидания перед постановкой заказа в очередь на
// подтверждение, а не настоящая банковская сверка: реальная приёмка
// платежей требует регистрации бизнеса и интеграции с платёжным
// провайдером/онлайн-кассой (54-ФЗ) — здесь этого нет.

import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { formatPrice } from '../store.jsx';

// Реальные реквизиты получателя.
//
// QR здесь кодирует просто номер телефона как текст (не банковский
// платёжный код) — у нас нет точных данных, зашитых в фирменный QR банка
// (включая контрольную сумму), а угадывать их нельзя: неверный QR отправит
// перевод в никуда. Отсканировав этот QR, покупатель видит номер и переводит
// вручную через своё банковское приложение — так же надёжно, просто удобнее.
const DEMO_RECIPIENT = {
  phone: '559 610 059',
  name: 'АБДУЛЛА Т.',
};

function PhoneQr({ phone }) {
  const [src, setSrc] = useState(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL('+996 ' + phone, { width: 200, margin: 1 }).then((url) => {
      if (!cancelled) setSrc(url);
    });
    return () => {
      cancelled = true;
    };
  }, [phone]);

  if (!src) return <div className="qr-mock" />;
  return <img src={src} alt="QR с номером телефона получателя" className="qr-real" />;
}

export default function PaymentModal({ order, onClose, onPaid }) {
  const [step, setStep] = useState('details');
  const [receiptFileName, setReceiptFileName] = useState(null);
  const [toast, setToast] = useState(null);
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);
  const toastTimer = useRef(null);

  useEffect(() => {
    return () => clearTimeout(toastTimer.current);
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

  async function sendToVerification() {
    setStep('verifying');
    setError(null);
    setSending(true);
    try {
      await onPaid(receiptFileName);
      setStep('confirmed');
    } catch (err) {
      setError(err.message);
      setStep('upload');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="pay-backdrop open" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pay-modal">
        <button className="pay-close-btn" type="button" onClick={onClose}>✕</button>

        {step === 'details' ? (
          <>
            <div className="pay-eyebrow">Оплата заказа {order.orderNumber}</div>
            <h2 className="pay-title">Переведите по реквизитам</h2>
            <span className="pay-demo-flag">⚠ Демо-режим: подтверждение перевода делает супер админ вручную — сам перевод по номеру телефона настоящий</span>
            <div className="pay-amount">
              <div className="pay-amount-label">Сумма к оплате</div>
              <div className="pay-amount-value">{formatPrice(order.total)}</div>
            </div>
            <PhoneQr phone={DEMO_RECIPIENT.phone} />
            <div className="qr-note">Отсканируйте QR, чтобы получить номер получателя, и переведите вручную через приложение банка (Optima Bank / любой банк с переводом по номеру)</div>
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
            <button className="pay-ghost-btn" type="button" onClick={onClose}>Закрыть</button>
          </>
        ) : null}

        {step === 'upload' ? (
          <>
            <div className="pay-eyebrow">Оплата заказа {order.orderNumber}</div>
            <h2 className="pay-title">Прикрепите квитанцию</h2>
            <p className="pay-sub">
              Загрузите скриншот или PDF подтверждения перевода — заказ встанет в очередь на подтверждение супер админом.
            </p>
            <label className={`pay-upload-box ${receiptFileName ? 'has-file' : ''}`}>
              <span className="pay-upload-icon">📎</span>
              <span>{receiptFileName ? '✓ ' + receiptFileName : 'Нажмите, чтобы выбрать файл'}</span>
              <input type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={handleFileChange} />
            </label>
            {error ? <div className="form-error">{error}</div> : null}
            <button
              className="btn btn-primary btn-large"
              style={{ width: '100%' }}
              type="button"
              disabled={!receiptFileName || sending}
              onClick={sendToVerification}
            >
              {sending ? 'Отправляем…' : 'Отправить на проверку'}
            </button>
            <button className="pay-ghost-btn" type="button" onClick={() => setStep('details')}>
              Назад к реквизитам
            </button>
          </>
        ) : null}

        {step === 'verifying' ? (
          <>
            <div className="pay-spinner" />
            <div className="pay-status-text">Отправляем квитанцию…</div>
            <div className="pay-status-sub">Дальше супер админ вручную сверит перевод</div>
          </>
        ) : null}

        {step === 'confirmed' ? (
          <>
            <div className="pay-success-badge">✓</div>
            <h2 className="pay-title" style={{ textAlign: 'center' }}>Квитанция отправлена</h2>
            <p className="pay-sub" style={{ textAlign: 'center' }}>
              Ждите подтверждения перевода — как только супер админ его проверит, заказ будет готов к выдаче. Статус можно
              отслеживать в разделе «Заказы».
            </p>
            <div className="pay-receipt-box">
              <div className="pay-receipt-line"><span>Заказ</span><span>{order.orderNumber}</span></div>
              <div className="pay-receipt-line"><span>Файл квитанции</span><span>{receiptFileName || '—'}</span></div>
              {order.items.map((p, i) => (
                <div className="pay-receipt-line" key={i}>
                  <span>{p.title} × {p.qty}</span>
                  <span>{formatPrice(p.price * p.qty)}</span>
                </div>
              ))}
              <div className="pay-receipt-line total"><span>Итого</span><span>{formatPrice(order.total)}</span></div>
            </div>
            <button className="btn btn-primary btn-large" style={{ width: '100%' }} type="button" onClick={onClose}>
              Готово
            </button>
          </>
        ) : null}
      </div>
      {toast ? <div className="pay-toast show">{toast}</div> : null}
    </div>
  );
}
