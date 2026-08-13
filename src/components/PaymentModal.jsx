// Демо-поток оплаты: реквизиты + QR-заглушка → загрузка квитанции → имитация проверки → чек.
// ВНИМАНИЕ: это симуляция для учебного проекта. Реальная приёмка платежей, сверка
// квитанций и печать фискального чека требуют регистрации бизнеса и интеграции
// с платёжным провайдером/онлайн-кассой (54-ФЗ) — здесь этого нет и быть не может.

import { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { formatPrice } from '../store.jsx';

// Настоящий статический QR для перевода через Kompanion Bank (Кыргызстан).
// Сумма в него не зашита (как у большинства статических личных QR) —
// покупатель вводит сумму вручную в приложении банка при сканировании.
const KOMPANION_QR_PAYLOAD =
  '0002010102115401032550015qr.kompanion.kg010410051012996755311172120211130212330401005303417520460125909KOMPANION3410DILFUZA+S.6304C5A5';

const DEMO_RECIPIENT = {
  phone: '755 311172',
  name: 'DILFUZA S.',
};

function RealQr({ data }) {
  const [src, setSrc] = useState(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(data, { width: 240, margin: 1 }).then((url) => {
      if (!cancelled) setSrc(url);
    });
    return () => {
      cancelled = true;
    };
  }, [data]);

  if (!src) return <div className="qr-mock" />;
  return <img src={src} alt="QR для перевода через Kompanion Bank" className="qr-real" />;
}

export default function PaymentModal({ items, cart, total, onClose, onDone }) {
  const [step, setStep] = useState('details');
  const [receiptFileName, setReceiptFileName] = useState(null);
  const [toast, setToast] = useState(null);
  const verifyTimer = useRef(null);
  const toastTimer = useRef(null);

  const order = useMemo(
    () => ({
      id: 'OP-' + Math.floor(100000 + Math.random() * 900000),
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
            <span className="pay-demo-flag">⚠ Демо-режим: проверка квитанции ниже имитируется — сам перевод по QR настоящий</span>
            <div className="pay-amount">
              <div className="pay-amount-label">Сумма к оплате</div>
              <div className="pay-amount-value">{formatPrice(total)}</div>
            </div>
            <RealQr data={KOMPANION_QR_PAYLOAD} />
            <div className="qr-note">Отсканируйте QR в приложении банка и введите сумму вручную (Kompanion Bank)</div>
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
