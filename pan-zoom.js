/* Pan and zoom for an SVG layer: drag, wheel, keyboard, fit, and an eased camera glide. */
(function (root) {
  'use strict';
  const reduced = () => root.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  class PanZoom {
    constructor(container, layer, { min = .08, max = 2.2, onChange } = {}) {
      Object.assign(this, { el: container, layer, min, max, onChange, x: 0, y: 0, k: 1, moved: false, inset: 0, content: { x: 0, y: 0, width: 1, height: 1 } });
      let drag = null;
      container.addEventListener('wheel', e => { e.preventDefault(); const r = container.getBoundingClientRect(); this.zoomBy(Math.exp(-e.deltaY * (e.ctrlKey ? .01 : .002)), e.clientX - r.left, e.clientY - r.top); }, { passive: false });
      container.addEventListener('pointerdown', e => { if (e.button !== 0) return; this.stop(); drag = { x: e.clientX, y: e.clientY, ox: this.x, oy: this.y }; this.moved = false; });
      root.addEventListener('pointermove', e => {
        if (!drag) return;
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 5) this.moved = true;
        if (this.moved) { container.classList.add('dragging'); this.x = drag.ox + dx; this.y = drag.oy + dy; this.apply(); }
      });
      const end = () => { drag = null; container.classList.remove('dragging'); };
      root.addEventListener('pointerup', end); root.addEventListener('pointercancel', end);
      container.addEventListener('keydown', e => {
        if (e.target !== container) return;
        if (e.key === '+' || e.key === '=') this.zoomBy(1.2); else if (e.key === '-') this.zoomBy(1 / 1.2); else if (e.key === '0') this.fit();
        else if (e.key.startsWith('Arrow')) { e.preventDefault(); this.x += e.key === 'ArrowLeft' ? 60 : e.key === 'ArrowRight' ? -60 : 0; this.y += e.key === 'ArrowUp' ? 60 : e.key === 'ArrowDown' ? -60 : 0; this.apply(); }
      });
    }
    get width() { return Math.max(120, this.el.clientWidth - this.inset); }
    get height() { return this.el.clientHeight; }
    apply() { this.layer.setAttribute('transform', `translate(${this.x.toFixed(1)},${this.y.toFixed(1)}) scale(${this.k.toFixed(4)})`); this.onChange?.(this); }
    zoomBy(f, cx = this.width / 2, cy = this.height / 2) { this.stop(); const old = this.k; this.k = Math.max(this.min, Math.min(this.max, this.k * f)); this.x = cx - (cx - this.x) * this.k / old; this.y = cy - (cy - this.y) * this.k / old; this.apply(); }
    fitTarget({ padding = 36, maxScale = 1, minScale = this.min } = {}) {
      const c = this.content, k = Math.max(minScale, Math.min(maxScale, (this.width - padding * 2) / c.width, (this.height - padding * 2) / c.height));
      return { k, x: (this.width - c.width * k) / 2 - c.x * k, y: Math.max(padding, (this.height - c.height * k) / 2) - c.y * k };
    }
    fit(options) { this.stop(); Object.assign(this, this.fitTarget(options)); this.apply(); }
    centerTarget(cx, cy, k = this.k) { return { k, x: this.width / 2 - cx * k, y: this.height / 2 - cy * k }; }
    // The signature move: the camera eases to a node rather than cutting, so the reader keeps their bearings.
    glide(target, ms = 460) {
      this.stop();
      if (reduced() || ms <= 0) { Object.assign(this, target); this.apply(); return; }
      const from = { x: this.x, y: this.y, k: this.k }, t0 = performance.now();
      const ease = t => t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      const frame = now => {
        const t = Math.min(1, (now - t0) / ms), e = ease(t);
        // Interpolate scale in log space so zooming feels even.
        this.k = Math.exp(Math.log(from.k) + (Math.log(target.k) - Math.log(from.k)) * e);
        this.x = from.x + (target.x - from.x) * e; this.y = from.y + (target.y - from.y) * e; this.apply();
        this.raf = t < 1 ? requestAnimationFrame(frame) : null;
      };
      this.raf = requestAnimationFrame(frame);
    }
    stop() { if (this.raf) cancelAnimationFrame(this.raf); this.raf = null; }
  }
  root.PanZoom = PanZoom;
})(window);
