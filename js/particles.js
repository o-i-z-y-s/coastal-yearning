/**
 * particles.js: custom replacement for the particles.js npm package.
 * SkyParticles    - twinkling stars on the sky canvas (capped at 24fps)
 * BubbleParticles - rising circles through the ocean canvas (capped at 20fps)
 *
 * Both systems skip drawing while window._scrubbing is true (clock drag active).
 * Star count scales with window._starVisibility (0=day, 1=midnight) set by main.js.
 */

// Pre-computed RGB strings for the three star colours
const STAR_RGB = {
  '#ffffff': '255,255,255',
  '#fff08f': '255,240,143',
  '#96ffff': '150,255,255',
};

class SkyParticles {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.particles = [];
    this._raf = null;
    this._lastFrame = 0;
    this._onResize = () => this._resize();
    this._boundTick = this._tick.bind(this);
    this._resize();
    window.addEventListener('resize', this._onResize);
    this._init();
    this._raf = requestAnimationFrame(this._boundTick);
  }

  _resize() {
    // Ignore iOS URL-bar height jitter: only relayout on a real width change.
    if (this.canvas.width === window.innerWidth) return;
    const prevW = this.canvas.width  || window.innerWidth;
    const prevH = this.canvas.height || window.innerHeight;
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
    const scaleX = this.canvas.width  / prevW;
    const scaleY = this.canvas.height / prevH;
    for (const p of this.particles) {
      p.x *= scaleX;
      p.y *= scaleY;
    }
  }

  _init() {
    const colors = Object.keys(STAR_RGB);
    const area   = window.innerWidth * window.innerHeight;
    // Generous pool: invisible stars cost nothing (skipped in _tick)
    const count  = Math.max(100, Math.min(Math.round(area / 5000), 400));
    for (let i = 0; i < count; i++) {
      const color = colors[Math.floor(Math.random() * colors.length)];
      // Each star gets its own opacity range, creating foreground/background depth
      const minOp = Math.random() * 0.08;
      const maxOp = Math.min(minOp + Math.random() * 0.87 + 0.08, 0.95);
      this.particles.push({
        x:          Math.random() * this.canvas.width,
        y:          Math.random() * this.canvas.height,
        rgb:        STAR_RGB[color],
        phase:      Math.random() * Math.PI * 2,   // random start in sine cycle
        phaseSpeed: Math.random() * 0.035 + 0.005, // vary twinkle rhythm per star
        minOp,
        maxOp,
        size:       Math.random() * 1.6 + 0.2,
      });
    }
  }

  _tick(ts) {
    this._raf = requestAnimationFrame(this._boundTick);

    // ~24fps cap - stars move so slowly that lower fps is imperceptible
    if (ts - this._lastFrame < 42) return;
    this._lastFrame = ts;

    const vis  = window._starVisibility ?? 1;
    // At low visibility (dusk/early evening), stars are weighted toward the zenith.
    // yPow=0 at midnight (uniform), yPow=4 at dusk (heavy top-bias).
    const yPow = (1 - vis) * 6;
    const H    = this.canvas.height;
    const ctx  = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, H);

    for (const p of this.particles) {
      p.phase += p.phaseSpeed;
      // Sinusoidal oscillation: smooth, non-linear, never synchronised across stars
      const t     = 0.5 * (1 + Math.sin(p.phase));
      const yFade = Math.pow(1 - p.y / H, yPow); // 1 at zenith, fades toward horizon
      const op    = (p.minOp + (p.maxOp - p.minOp) * t) * vis * yFade;
      // Skip the draw call entirely for stars too faint to see
      if (op < 0.01) continue;
      ctx.fillStyle = `rgba(${p.rgb},${op.toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  destroy() {
    cancelAnimationFrame(this._raf);
    window.removeEventListener('resize', this._onResize);
  }
}


class BubbleParticles {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.bubbles = [];
    this._raf = null;
    this._lastFrame = 0;
    this._onResize = () => this._resize();
    this._onClick  = () => this._addBubbles(4);
    this._boundTick = this._tick.bind(this);
    this._resize();
    window.addEventListener('resize', this._onResize);
    this.canvas.addEventListener('click', this._onClick);
    this._initBubbles(8);
    this._raf = requestAnimationFrame(this._boundTick);
  }

  _resize() {
    const w = this.canvas.offsetWidth || window.innerWidth;
    if (this.canvas.width === w) return;
    this.canvas.width  = w;
    this.canvas.height = this.canvas.offsetHeight || window.innerHeight;
  }

  _makeBubble(randomY = false) {
    return {
      x:       Math.random() * this.canvas.width,
      y:       randomY ? Math.random() * this.canvas.height : this.canvas.height + 10,
      size:    Math.random() * 4 + 2,
      speed:   Math.random() * 0.35 + 0.25,
      opacity: Math.random() * 0.25 + 0.15,
    };
  }

  _initBubbles(n)  { for (let i = 0; i < n; i++) this.bubbles.push(this._makeBubble(true));  }
  _addBubbles(n)   { const MAX = 30; for (let i = 0; i < n && this.bubbles.length < MAX; i++) this.bubbles.push(this._makeBubble(false)); }

  _tick(ts) {
    this._raf = requestAnimationFrame(this._boundTick);

    // 20fps cap
    if (ts - this._lastFrame < 50) return;
    this._lastFrame = ts;

    // Yield frames to the clock scrubber during active drag
    if (window._scrubbing) return;

    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Bubbles fade to zero in the top 10% of the canvas so they dissolve
    // into the wave surface rather than popping against a hard wall.
    const fadeZone = this.canvas.height * 0.10;

    for (const b of this.bubbles) {
      b.y -= b.speed;
      if (b.y + b.size < 0) {
        Object.assign(b, this._makeBubble(false));
      }
      const surfaceFade = b.y <= fadeZone ? Math.max(0, b.y / fadeZone) : 1;
      const op = b.opacity * surfaceFade;
      if (op < 0.01) continue;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${op.toFixed(2)})`;
      ctx.fill();
    }
  }

  destroy() {
    cancelAnimationFrame(this._raf);
    window.removeEventListener('resize', this._onResize);
    this.canvas.removeEventListener('click', this._onClick);
  }
}
