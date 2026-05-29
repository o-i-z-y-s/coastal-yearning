/**
 * planets.js -- solar system bodies visible in the western sky
 * over coastal California (35 deg N, 120 deg W).
 *
 * Positions computed from simplified Keplerian orbital elements
 * (NASA JPL approximation, accurate to ~1 arc-minute, 1800-2050).
 *
 * Only planets above the horizon (alt > 1 deg) in the western semicircle
 * (az 180-360 deg) are drawn, fading with sky brightness like the stars.
 *
 * Reads window._currentSecs (set by main.js via placeSunMoon) for the
 * current display time; falls back to real local time.
 * Reads window._starVisibility for opacity gating (0 = full day, 1 = midnight).
 * Respects window._scrubbing to yield frames during clock drag.
 */

'use strict';

// ── Constants ────────────────────────────────────────────────────────────────

const _D2R = Math.PI / 180;
const _R2D = 180 / Math.PI;
const _OBS_LAT = 35.0 * _D2R;   // coastal California
const _OBS_LON = -120.0;          // degrees east (negative = west)

// ── Planetary visual properties + Keplerian elements ─────────────────────────
// Elements: [J2000.0 value, rate per Julian century]
// a (AU), e (dimensionless), I / L / wbar / node (degrees)

const _PLANET_DATA = [
  {
    name: 'Venus',
    core: '#ddeeff',
    glow: [180, 215, 255],
    coreR: 3.5, glowR: 18,
    pulse: true,   // Venus has a slight twinkle near the horizon
    a:    [ 0.72333566,  0.00000390],
    e:    [ 0.00677672, -0.00004107],
    I:    [ 3.39467605, -0.00078890],
    L:    [181.97909950, 58517.81538729],
    wbar: [131.60246718,  0.00268329],
    node: [ 76.67984255, -0.27769418],
  },
  {
    name: 'Mars',
    core: '#ff6630',
    glow: [255, 100, 48],
    coreR: 2.5, glowR: 12,
    pulse: false,
    a:    [ 1.52371034,  0.00001847],
    e:    [ 0.09339410,  0.00007882],
    I:    [ 1.84969142, -0.00813131],
    L:    [-4.55343205, 19140.30268499],
    wbar: [-23.94362959,  0.44441088],
    node: [ 49.55953891, -0.29257343],
  },
  {
    name: 'Jupiter',
    core: '#f5e0b0',
    glow: [240, 210, 150],
    coreR: 4.5, glowR: 22,
    pulse: false,
    a:    [ 5.20288700, -0.00011607],
    e:    [ 0.04838624, -0.00013253],
    I:    [ 1.30439695, -0.00183714],
    L:    [34.39644051,  3034.74612775],
    wbar: [14.72847983,    0.21252668],
    node: [100.47390909,   0.20469106],
  },
  {
    name: 'Saturn',
    core: '#ffe07a',
    glow: [255, 210, 80],
    coreR: 3.5, glowR: 17,
    pulse: false,
    a:    [ 9.53667594, -0.00125060],
    e:    [ 0.05386179, -0.00050991],
    I:    [ 2.48599187,  0.00193609],
    L:    [49.95424423,  1222.49362201],
    wbar: [92.59887831,    -0.41897216],
    node: [113.66242448,   -0.28867794],
  },
];

// Earth orbital elements (needed for heliocentric -> geocentric conversion)
const _EARTH_ELEMS = {
  a:    [1.00000261,  0.00000562],
  e:    [0.01671123, -0.00004392],
  I:    [-0.00001531, -0.01294668],
  L:    [100.46457166, 35999.37244981],
  wbar: [102.93768193,  0.32327364],
  node: [0.0, 0.0],
};

// ── Math helpers ──────────────────────────────────────────────────────────────

function _norm360(deg) { return ((deg % 360) + 360) % 360; }

function _julianDate(date) { return date.getTime() / 86400000 + 2440587.5; }

// ── Orbital mechanics ─────────────────────────────────────────────────────────

function _elementsAt(p, T) {
  return {
    a:    p.a[0]    + p.a[1]    * T,
    e:    p.e[0]    + p.e[1]    * T,
    I:    p.I[0]    + p.I[1]    * T,
    L:    p.L[0]    + p.L[1]    * T,
    wbar: p.wbar[0] + p.wbar[1] * T,
    node: p.node[0] + p.node[1] * T,
  };
}

function _solveKepler(M_deg, e) {
  // Newton-Raphson solution of Kepler's equation: E - e*sin(E) = M
  const M = _norm360(M_deg) * _D2R;
  let E = M;
  for (let i = 0; i < 15; i++) {
    const dE = (M - E + e * Math.sin(E)) / (1 - e * Math.cos(E));
    E += dE;
    if (Math.abs(dE) < 1e-10) break;
  }
  return E; // eccentric anomaly (radians)
}

function _helioEcliptic(elems) {
  // Argument of perihelion and mean anomaly
  const w    = (elems.wbar - elems.node) * _D2R;
  const node = elems.node * _D2R;
  const inc  = elems.I    * _D2R;
  const E    = _solveKepler(elems.L - elems.wbar, elems.e);

  // Position in orbital plane
  const xp = elems.a * (Math.cos(E) - elems.e);
  const yp = elems.a * Math.sqrt(1 - elems.e * elems.e) * Math.sin(E);

  // Rotate to heliocentric ecliptic frame
  const cW = Math.cos(w), sW = Math.sin(w);
  const cN = Math.cos(node), sN = Math.sin(node);
  const cI = Math.cos(inc),  sI = Math.sin(inc);

  return {
    x: (cW * cN - sW * sN * cI) * xp + (-sW * cN - cW * sN * cI) * yp,
    y: (cW * sN + sW * cN * cI) * xp + (-sW * sN + cW * cN * cI) * yp,
    z: (sW * sI)                 * xp + ( cW * sI)                 * yp,
  };
}

function _toHorizontal(RA_deg, dec_deg, jd) {
  // Greenwich Mean Sidereal Time (degrees)
  const D    = jd - 2451545.0;
  const GMST = _norm360(280.46061837 + 360.98564736629 * D);
  const LST  = _norm360(GMST + _OBS_LON);
  const H    = LST - RA_deg; // hour angle (degrees)
  const Hr   = H  * _D2R;

  const dec  = dec_deg * _D2R;
  const lat  = _OBS_LAT;
  const sinA = Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(Hr);
  const alt  = Math.asin(Math.max(-1, Math.min(1, sinA)));
  const cAlt = Math.cos(alt);

  let az = 0;
  if (cAlt > 1e-10) {
    const sinAz = -Math.cos(dec) * Math.sin(Hr) / cAlt;
    const cosAz = (Math.sin(dec) - Math.sin(lat) * sinA) / (cAlt * Math.cos(lat));
    az = _norm360(Math.atan2(sinAz, cosAz) * _R2D);
  }

  return { alt: alt * _R2D, az };
}

function _computePos(planet, T, jd, oblR) {
  const pe = _elementsAt(planet, T);
  const ee = _elementsAt(_EARTH_ELEMS, T);
  const ph = _helioEcliptic(pe);
  const eh = _helioEcliptic(ee);

  // Geocentric ecliptic
  const gx = ph.x - eh.x;
  const gy = ph.y - eh.y;
  const gz = ph.z - eh.z;

  // Ecliptic -> equatorial (rotate by obliquity)
  const cO = Math.cos(oblR), sO = Math.sin(oblR);
  const eqx = gx;
  const eqy = cO * gy - sO * gz;
  const eqz = sO * gy + cO * gz;
  const r   = Math.sqrt(eqx * eqx + eqy * eqy + eqz * eqz);

  const RA  = _norm360(Math.atan2(eqy, eqx) * _R2D);
  const dec = Math.asin(Math.max(-1, Math.min(1, eqz / r))) * _R2D;

  return _toHorizontal(RA, dec, jd);
}

// ── PlanetRenderer ────────────────────────────────────────────────────────────

class PlanetRenderer {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'planet-canvas';
    Object.assign(this.canvas.style, {
      position: 'absolute', inset: '0', zIndex: '1',
      width: '100%', height: '100%', pointerEvents: 'none',
    });
    const hero = document.getElementById('sky-hero');
    if (!hero) return;
    hero.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');

    // Pill-style hover label
    this._tip = document.createElement('div');
    Object.assign(this._tip.style, {
      position: 'absolute', zIndex: '10',
      background: 'rgba(0,0,0,0.52)',
      border: '1px solid rgba(255,255,255,0.18)',
      borderRadius: '999px',
      color: 'rgba(255,255,255,0.82)',
      fontFamily: 'Montserrat,-apple-system,sans-serif',
      fontSize: '0.62rem', fontWeight: '700',
      letterSpacing: '0.1em', textTransform: 'uppercase',
      padding: '5px 12px',
      pointerEvents: 'none',
      opacity: '0',
      transition: 'opacity 0.15s ease',
      whiteSpace: 'nowrap',
    });
    hero.appendChild(this._tip);

    hero.addEventListener('mousemove', e => this._onMouseMove(e));
    hero.addEventListener('mouseleave', () => { this._tip.style.opacity = '0'; });

    // Dismiss when touching anything outside the nearest planet — covers the
    // clock scrubber (outside #sky-hero) and other off-hero taps on mobile.
    document.addEventListener('pointerdown', e => {
      if (this._tip.style.opacity === '0') return;
      const rect = this.canvas.getBoundingClientRect();
      const mx   = e.clientX - rect.left;
      const my   = e.clientY - rect.top;
      const near = this._rendered.some(rp => Math.hypot(mx - rp.x, my - rp.y) < 32);
      if (!near) this._tip.style.opacity = '0';
    }, { capture: true });
    this._positions     = [];
    this._rendered      = []; // cached {planet, x, y} for hover checks
    this._lastFrame     = 0;
    this._lastPosUpdate = -Infinity;
    this._lastSecs      = -1;
    this._boundTick     = this._tick.bind(this);
    this._resize();
    window.addEventListener('resize', () => this._resize());
    requestAnimationFrame(this._boundTick);
  }

  _resize() {
    const hero = document.getElementById('sky-hero');
    this.canvas.width  = hero ? hero.offsetWidth  : window.innerWidth;
    this.canvas.height = hero ? hero.offsetHeight : window.innerHeight;
  }

  _getDisplayDate() {
    const base = (window._currentDate instanceof Date) ? window._currentDate : new Date();
    if (typeof window._currentSecs === 'number') {
      const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
      d.setSeconds(window._currentSecs);
      return d;
    }
    return base;
  }

  _updatePositions() {
    const date = this._getDisplayDate();
    const jd   = _julianDate(date);
    const T    = (jd - 2451545.0) / 36525.0;
    const oblR = (23.439291 - 0.013004 * T) * _D2R;

    this._positions = _PLANET_DATA.map(p => {
      const pos = _computePos(p, T, jd, oblR);
      return { planet: p, alt: pos.alt, az: pos.az };
    }).filter(pos => pos.alt > 1.0 && pos.az >= 180 && pos.az <= 360);
  }

  _onMouseMove(e) {
    const rect  = this.canvas.getBoundingClientRect();
    const mx    = e.clientX - rect.left;
    const my    = e.clientY - rect.top;
    const DIST  = 32; // px proximity threshold
    let hit = null;
    let best = Infinity;
    for (const rp of this._rendered) {
      const d = Math.hypot(mx - rp.x, my - rp.y);
      if (d < DIST && d < best) { best = d; hit = rp; }
    }
    if (hit) {
      this._tip.textContent = hit.planet.name;
      // Position pill above-right of planet, clamped to all four canvas edges.
      const tw = this._tip.offsetWidth  || 70;
      const th = this._tip.offsetHeight || 22;
      const px = Math.max(8, Math.min(hit.x + 10,      this.canvas.width  - tw - 8));
      const py = Math.max(4, Math.min(hit.y - th - 8,  this.canvas.height - th - 8));
      this._tip.style.left    = px + 'px';
      this._tip.style.top     = py + 'px';
      this._tip.style.opacity = '1';
    } else {
      this._tip.style.opacity = '0';
    }
  }

  _tick(ts) {
    requestAnimationFrame(this._boundTick);

    if (ts - this._lastFrame < 50) return; // 20fps cap
    this._lastFrame = ts;

    // Recalculate whenever the display time changes or every 30s at rest.
    const _curSecs = typeof window._currentSecs === 'number' ? window._currentSecs : -1;
    if (_curSecs !== this._lastSecs || ts - this._lastPosUpdate > 30000) {
      this._updatePositions();
      this._lastPosUpdate = ts;
      this._lastSecs = _curSecs;
    }

    this._draw(ts);
  }

  // Called synchronously by main.js from _process() so planet positions
  // update in the same animation frame as placeSunMoon() -- zero perceived lag.
  drawNow() {
    const ts = performance.now();
    const _curSecs = typeof window._currentSecs === 'number' ? window._currentSecs : -1;
    this._updatePositions();
    this._lastPosUpdate = ts;
    this._lastSecs = _curSecs;
    this._draw(ts);
  }

  _draw(ts) {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const vis = window._starVisibility ?? 0;
    // Planets are brighter than stars -- visible at roughly half the star threshold
    const baseOp = Math.min(1, vis * 2.5);
    if (baseOp < 0.02 || this._positions.length === 0) return;

    const W = this.canvas.width;
    const H = this.canvas.height;
    this._rendered = [];

    for (const pos of this._positions) {
      const p = pos.planet;

      // Canvas mapping:
      //   az 180 (south) -> x = 0 (left)
      //   az 270 (west)  -> x = W/2 (center)
      //   az 360 (north) -> x = W (right)
      //   alt 0          -> y = H (horizon)
      //   alt 90         -> y = 0 (zenith)
      const x = ((pos.az - 180) / 180) * W;
      const y = (1 - pos.alt / 90) * H;
      this._rendered.push({ planet: p, x, y });

      // Fade out near horizon (atmospheric extinction)
      const altFade = Math.min(1, pos.alt / 8);
      const opacity  = baseOp * altFade;
      if (opacity < 0.02) continue;

      // Venus pulses gently; other planets hold steady
      const pulse    = p.pulse ? (0.88 + 0.12 * Math.sin(ts * 0.0025)) : 1;
      const finalOp  = opacity * pulse;
      const [r, g, b] = p.glow;

      // Soft glow (radial gradient)
      const gr   = p.glowR;
      const grad = this.ctx.createRadialGradient(x, y, 0, x, y, gr);
      grad.addColorStop(0,    `rgba(${r},${g},${b},${(finalOp * 0.65).toFixed(3)})`);
      grad.addColorStop(0.35, `rgba(${r},${g},${b},${(finalOp * 0.25).toFixed(3)})`);
      grad.addColorStop(1,    `rgba(${r},${g},${b},0)`);
      this.ctx.beginPath();
      this.ctx.arc(x, y, gr, 0, Math.PI * 2);
      this.ctx.fillStyle = grad;
      this.ctx.fill();

      // Crisp core (no twinkle on fill -- that's the glow's job)
      this.ctx.globalAlpha = finalOp;
      this.ctx.beginPath();
      this.ctx.arc(x, y, p.coreR, 0, Math.PI * 2);
      this.ctx.fillStyle = p.core;
      this.ctx.fill();
      this.ctx.globalAlpha = 1;
    }
  }
}

// ── Init (runs after DOM is ready -- script is at bottom of <body>) ───────────

(function () {
  if (!document.getElementById('sky-hero')) return;

  window._planetRenderer = new PlanetRenderer();

})();