import { useEffect, useRef, useState } from 'react';

const DISPLAY_MAX_SIDE = 320;
const OUTPUT_MAX_SIDE = 640;
const HANDLE_HIT_RADIUS = 20;
const MIN_CROP = 0.15;

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

// Лёгкий редактор фото прямо в браузере — без сторонних приложений и
// библиотек, только canvas: повернуть, обрезать (тянуть за уголки рамки),
// поднять/понизить яркость и контраст. Возвращает готовую dataURL так же,
// как исходный resizeImageToDataUrl в AddProductModal.jsx.
export default function PhotoEditor({ src, onCancel, onDone }) {
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const dragRef = useRef(null); // { mode, px, py, x, y, w, h }
  const [ready, setReady] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [crop, setCrop] = useState({ x: 0.03, y: 0.03, w: 0.94, h: 0.94 });

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setReady(true);
    };
    img.src = src;
  }, [src]);

  function getRotatedSize() {
    const img = imgRef.current;
    if (!img) return { w: 0, h: 0 };
    return rotation % 180 !== 0 ? { w: img.height, h: img.width } : { w: img.width, h: img.height };
  }

  useEffect(() => {
    if (!ready) return;
    const canvas = canvasRef.current;
    const img = imgRef.current;
    const { w: rw, h: rh } = getRotatedSize();
    if (!canvas || !img || !rw || !rh) return;

    const scale = Math.min(DISPLAY_MAX_SIDE / rw, DISPLAY_MAX_SIDE / rh, 1);
    const dispW = Math.round(rw * scale);
    const dispH = Math.round(rh * scale);
    canvas.width = dispW;
    canvas.height = dispH;
    const ctx = canvas.getContext('2d');

    ctx.save();
    ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;
    ctx.translate(dispW / 2, dispH / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.drawImage(img, -(img.width * scale) / 2, -(img.height * scale) / 2, img.width * scale, img.height * scale);
    ctx.restore();

    const cx = crop.x * dispW;
    const cy = crop.y * dispH;
    const cw = crop.w * dispW;
    const ch = crop.h * dispH;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(0, 0, dispW, cy);
    ctx.fillRect(0, cy + ch, dispW, dispH - cy - ch);
    ctx.fillRect(0, cy, cx, ch);
    ctx.fillRect(cx + cw, cy, dispW - cx - cw, ch);

    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(cx, cy, cw, ch);

    const hs = 12;
    ctx.fillStyle = '#fff';
    [
      [cx, cy],
      [cx + cw, cy],
      [cx, cy + ch],
      [cx + cw, cy + ch],
    ].forEach(([hx, hy]) => {
      ctx.fillRect(hx - hs / 2, hy - hs / 2, hs, hs);
    });
  }, [ready, rotation, brightness, contrast, crop]);

  function pointerToNorm(e) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      px: clamp((e.clientX - rect.left) / rect.width, 0, 1),
      py: clamp((e.clientY - rect.top) / rect.height, 0, 1),
      pxPixels: e.clientX - rect.left,
      pyPixels: e.clientY - rect.top,
    };
  }

  function handlePointerDown(e) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    const { px, py, pxPixels, pyPixels } = pointerToNorm(e);
    const cx = crop.x * canvas.width;
    const cy = crop.y * canvas.height;
    const cw = crop.w * canvas.width;
    const ch = crop.h * canvas.height;
    const corners = { nw: [cx, cy], ne: [cx + cw, cy], sw: [cx, cy + ch], se: [cx + cw, cy + ch] };
    let mode = null;
    for (const [key, [hx, hy]] of Object.entries(corners)) {
      if (Math.hypot(pxPixels - hx, pyPixels - hy) <= HANDLE_HIT_RADIUS) {
        mode = key;
        break;
      }
    }
    if (!mode && pxPixels >= cx && pxPixels <= cx + cw && pyPixels >= cy && pyPixels <= cy + ch) {
      mode = 'move';
    }
    if (!mode) return;
    dragRef.current = { mode, px, py, ...crop };
  }

  function handlePointerMove(e) {
    if (!dragRef.current) return;
    const { px, py } = pointerToNorm(e);
    const start = dragRef.current;
    setCrop(() => {
      let { x, y, w, h } = start;
      if (start.mode === 'move') {
        const dx = px - start.px;
        const dy = py - start.py;
        x = clamp(start.x + dx, 0, 1 - w);
        y = clamp(start.y + dy, 0, 1 - h);
      } else {
        let left = start.x;
        let top = start.y;
        let right = start.x + start.w;
        let bottom = start.y + start.h;
        if (start.mode.includes('w')) left = clamp(px, 0, right - MIN_CROP);
        if (start.mode.includes('e')) right = clamp(px, left + MIN_CROP, 1);
        if (start.mode.includes('n')) top = clamp(py, 0, bottom - MIN_CROP);
        if (start.mode.includes('s')) bottom = clamp(py, top + MIN_CROP, 1);
        x = left;
        y = top;
        w = right - left;
        h = bottom - top;
      }
      return { x, y, w, h };
    });
  }

  function handlePointerUp() {
    dragRef.current = null;
  }

  function handleRotate() {
    setRotation((r) => (r + 90) % 360);
    setCrop({ x: 0.03, y: 0.03, w: 0.94, h: 0.94 });
  }

  function applyAndFinish() {
    const img = imgRef.current;
    if (!img) return;
    const { w: rw, h: rh } = getRotatedSize();

    const rotated = document.createElement('canvas');
    rotated.width = rw;
    rotated.height = rh;
    const rctx = rotated.getContext('2d');
    rctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;
    rctx.translate(rw / 2, rh / 2);
    rctx.rotate((rotation * Math.PI) / 180);
    rctx.drawImage(img, -img.width / 2, -img.height / 2, img.width, img.height);

    const sx = crop.x * rw;
    const sy = crop.y * rh;
    const sw = crop.w * rw;
    const sh = crop.h * rh;
    const outScale = Math.min(1, OUTPUT_MAX_SIDE / Math.max(sw, sh));

    const final = document.createElement('canvas');
    final.width = Math.max(1, Math.round(sw * outScale));
    final.height = Math.max(1, Math.round(sh * outScale));
    final.getContext('2d').drawImage(rotated, sx, sy, sw, sh, 0, 0, final.width, final.height);

    onDone(final.toDataURL('image/jpeg', 0.85));
  }

  return (
    <div className="pay-backdrop open" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="pay-modal photo-editor-modal">
        <button className="pay-close-btn" type="button" onClick={onCancel}>✕</button>
        <div className="pay-eyebrow">Фото товара</div>
        <h2 className="pay-title">Обрежьте и настройте фото</h2>
        <p className="pay-sub">Потяните за уголки рамки, чтобы обрезать лишнее, или за середину — чтобы подвинуть.</p>

        <div className="photo-editor-canvas-wrap">
          {ready ? (
            <canvas
              ref={canvasRef}
              className="photo-editor-canvas"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            />
          ) : (
            <span className="pay-sub">Загружаем фото…</span>
          )}
        </div>

        <button className="pay-ghost-btn" type="button" onClick={handleRotate}>
          ⟲ Повернуть на 90°
        </button>

        <label className="photo-editor-slider">
          <span>Яркость</span>
          <input type="range" min="50" max="150" value={brightness} onChange={(e) => setBrightness(Number(e.target.value))} />
        </label>
        <label className="photo-editor-slider">
          <span>Контраст</span>
          <input type="range" min="50" max="150" value={contrast} onChange={(e) => setContrast(Number(e.target.value))} />
        </label>

        <button className="btn btn-primary btn-large" style={{ width: '100%', marginTop: 10 }} type="button" onClick={applyAndFinish} disabled={!ready}>
          Готово
        </button>
      </div>
    </div>
  );
}
