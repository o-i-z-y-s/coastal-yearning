/**
 * main.js — site logic.
 * Handles: time detection, time-of-day colour themes, sun/moon arc,
 * time toggle, and rendering all content from content.js.
 */

// ── Dev mode (localhost only) ────────────────────────────────────────────────
const DEV = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

let devMoonPhase = null;  // null = use real calculated phase
let _devPhaseIdx = 8;     // starts at the "Real Phase" sentinel

// ── Theme definitions ────────────────────────────────────────────────────────

const THEMES = {
  dawn: {
    pulldown:   '#0c3575',
    oceanFloor: '#001230',
  },
  day: {
    pulldown:   '#096dd9',
    oceanFloor: '#001b36',
  },
  dusk: {
    pulldown:   '#312678',
    oceanFloor: '#00070f',
  },
  night: {
    pulldown:   '#010b17',
    oceanFloor: '#000012',
  },
  midnight: {
    pulldown:   '#000810',
    oceanFloor: '#000008',
  },
};

// ── Colour helpers ───────────────────────────────────────────────────────────

/** Linear interpolate two [r, g, b] arrays; returns a new [r, g, b] array. */
function lerpRGB(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

// ── Sky gradient interpolation ───────────────────────────────────────────────
// Five shared stop positions. Colors are [r, g, b] arrays for each theme.

const SKY_STOPS = {
  //                  -10%             20%              60%              82%              140%
  dawn:     [ [50,120,178], [75,145,195], [130,178,212], [215,182,172], [242,210,162] ],
  day:      [ [0,22,98],   [10,70,168], [85,145,208],  [148,192,226], [220,242,255] ],
  dusk:     [ [26,15,92],  [123,37,96], [196,64,16],   [240,124,20],  [255,192,96]  ],
  night:    [ [1,10,21],   [2,18,36],   [5,32,58],     [8,38,68],     [13,56,93]    ],
  evening:  [ [4,8,28],    [10,12,50],  [22,14,62],    [75,28,78],    [120,48,68]   ],
  midnight: [ [0,5,14],    [1,10,26],   [3,18,40],     [3,16,36],     [4,18,40]     ],
};

// Representative hours at which each theme is fully "pure" (used by toggle buttons)
const THEME_HOURS = { dawn: 6, day: 12, dusk: 18.5, night: 21, midnight: 0 };

// ── Segment tables ───────────────────────────────────────────────────────────
// Each entry: [hourStart, hourEnd, themeFrom, themeTo]

const SKY_SEGS = [
  [0,    2.0,  'midnight', 'midnight'],
  [2.0,  4.5,  'midnight', 'night'  ],
  [4.5,  5.5,  'night',    'dawn'   ],
  [5.5,  6.5,  'dawn',     'dawn'   ],  // pure dawn — Belt of Venus visible
  [6.5,  8.0,  'dawn',     'day'    ],
  [8.0,  16.0, 'day',      'day'    ],
  [16.0, 18.0, 'day',      'dusk'   ],
  [18.0, 19.0, 'dusk',     'dusk'   ],  // pure sunset
  [19.0, 19.5, 'dusk',     'evening'],
  [19.5, 20.0, 'evening',  'night'  ],
  [20.0, 22.0, 'night',    'night'  ],
  [22.0, 24.0, 'night',    'midnight'],
];

const OCEAN_SEGS = [
  [0,    2.0,  'midnight', 'midnight'],
  [2.0,  5.0,  'midnight', 'night'  ],
  [5.0,  6.0,  'night',    'dawn'   ],
  [6.0,  7.0,  'dawn',     'dawn'   ],
  [7.0,  8.0,  'dawn',     'day'    ],
  [8.0,  17.0, 'day',      'day'    ],
  [17.0, 18.0, 'day',      'dusk'   ],
  [18.0, 19.0, 'dusk',     'dusk'   ],
  [19.0, 19.5, 'dusk',     'evening'],
  [19.5, 20.0, 'evening',  'night'  ],
  [20.0, 22.0, 'night',    'night'  ],
  [22.0, 24.0, 'night',    'midnight'],
];

/**
 * Returns { from, to, t } for the two bracketing themes at a given hour.
 * Pure segments return from === to so the lerp resolves to the exact anchor.
 */
function getBlend(hours, segs) {
  const h = ((hours % 24) + 24) % 24;
  for (const [a, b, from, to] of segs) {
    if (h >= a && h < b) return { from, to, t: (h - a) / (b - a) };
  }
  return { from: 'night', to: 'night', t: 0 };
}

function getSkyBlend(hours)   { return getBlend(hours, SKY_SEGS);   }
function getOceanBlend(hours) { return getBlend(hours, OCEAN_SEGS); }


/**
 * Paints the sky gradient directly onto the dedicated gradient canvas.
 * Avoids CSS style recalc entirely -- canvas fillRect is a direct GPU op.
 * CSS stop positions span [-10%, 140%]; colours at the visible edges
 * (0% and 100%) are interpolated from the surrounding stops exactly.
 */
function paintSkyGradient(hours, blend) {
  const canvas = _el.gradientCanvas;
  if (!canvas) return;
  const ctx = _el.gradientCtx;
  const { from, to, t } = blend || getSkyBlend(hours);
  const a = SKY_STOPS[from], b = SKY_STOPS[to];
  const c = [0, 1, 2, 3, 4].map(i => lerpRGB(a[i], b[i], t));
  // Exact colours at viewport edges (0% and 100%)
  const cTop    = lerpRGB(c[0], c[1], 10 / 30); // 0% is 10/30 between -10% and 20%
  const cBottom = lerpRGB(c[3], c[4], 18 / 58); // 100% is 18/58 between 82% and 140%
  const toRgb = ([r, g, bl]) => `rgb(${r},${g},${bl})`;
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0.00, toRgb(cTop));
  grad.addColorStop(0.20, toRgb(c[1]));
  grad.addColorStop(0.60, toRgb(c[2]));
  grad.addColorStop(0.82, toRgb(c[3]));
  grad.addColorStop(1.00, toRgb(cBottom));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// ── Ocean gradient interpolation ─────────────────────────────────────────────
// Mirrors the sky system: four stop positions, RGB arrays per theme.

const OCEAN_STOPS = {
  //                top             upper-mid       lower-mid       bottom
  dawn:     [ [55,110,158], [35,78,130],  [18,48,98],  [8,25,65]  ],
  day:      [ [36,100,143], [12,78,129],  [4,51,92],   [0,27,54]  ],
  dusk:     [ [12,78,129],  [4,51,92],   [0,27,54],   [0,7,15]   ],
  night:    [ [14,18,69],   [2,5,56],    [0,0,18],    [0,0,18]   ],
  evening:  [ [18,12,58],   [7,6,42],    [2,2,25],    [0,1,16]   ],
  midnight: [ [4,5,32],     [1,3,38],    [0,0,12],    [0,0,10]   ],
};

function buildOceanGradient(hours, blend) {
  const { from, to, t } = blend || getOceanBlend(hours);
  const a = OCEAN_STOPS[from], b = OCEAN_STOPS[to];
  const stops = [0, 1, 2, 3].map(i => {
    const [r, g, bl] = lerpRGB(a[i], b[i], t);
    return `rgb(${r},${g},${bl})`;
  });
  return `linear-gradient(to bottom, ${stops.join(', ')})`;
}

/**
 * Returns an interpolated ocean stop as an rgb() string.
 * index: 0 = top (wave fill), 3 = bottom (footer background).
 */
function getOceanStop(hours, index, blend) {
  const { from, to, t } = blend || getOceanBlend(hours);
  const [r, g, bl] = lerpRGB(OCEAN_STOPS[from][index], OCEAN_STOPS[to][index], t);
  return `rgb(${r},${g},${bl})`;
}

// ── Sky-surface haze interpolation ───────────────────────────────────────────
// The surface element is a single rgba stop fading to transparent.

const SURFACE_STOPS = {
  //           r    g    b     a
  dawn:     [ 190, 148, 115, 0.50 ],  // warm peach haze from horizon glow
  day:      [  36, 100, 143, 0.85 ],
  dusk:     [  20,   8,  40, 0.60 ],
  night:    [  14,  18,  69, 0.95 ],
  evening:  [  45,  18,  65, 0.82 ],
  midnight: [   2,   4,  14, 0.92 ],
};

function buildSurfaceGradient(hours, blend) {
  const { from, to, t } = blend || getSkyBlend(hours);
  const a = SURFACE_STOPS[from], b = SURFACE_STOPS[to];
  const [r, g, bl] = lerpRGB(a, b, t);
  const al = +(a[3] + (b[3] - a[3]) * t).toFixed(3);
  return `linear-gradient(to top, rgba(${r},${g},${bl},${al}) 0%, transparent 100%)`;
}

// ── DOM element cache ────────────────────────────────────────────────────────
// Populated once at DOMContentLoaded; keeps getElementById out of every hot path.

const _el = {};

// Dirty-check caches so unchanged CSS values are never re-assigned.
let _lastSurfGrad   = '';
let _lastWaveColor  = '';
let _lastOceanGrad  = '';
let _lastFooterColor = '';

/**
 * Apply gradient outputs for the given hour.
 * skyOnly = true: update only sky, surface haze, and wave fill — used during
 * active scrubbing when the ocean section is below the fold and invisible.
 * A full update is fired on pointer release.
 */
function applyGradients(hours, skyOnly) {
  const skyB   = getSkyBlend(hours);
  const oceanB = getOceanBlend(hours);
  paintSkyGradient(hours, skyB);
  window._starVisibility = getStarVisibility(hours, skyB);
  const surfGrad = buildSurfaceGradient(hours, skyB);
  if (surfGrad !== _lastSurfGrad) {
    _lastSurfGrad = surfGrad;
    if (_el.surface) _el.surface.style.background = surfGrad;
  }
  const waveColor = getOceanStop(hours, 0, oceanB);
  if (waveColor !== _lastWaveColor) {
    _lastWaveColor = waveColor;
    _el.wavePaths.forEach(p => p.setAttribute('fill', waveColor));
  }
  if (!skyOnly) {
    const oceanGrad = buildOceanGradient(hours, oceanB);
    if (oceanGrad !== _lastOceanGrad) {
      _lastOceanGrad = oceanGrad;
      if (_el.ocean) _el.ocean.style.background = oceanGrad;
    }
    const footerColor = getOceanStop(hours, 3, oceanB);
    if (footerColor !== _lastFooterColor) {
      _lastFooterColor = footerColor;
      if (_el.footer) _el.footer.style.backgroundColor = footerColor;
    }
    document.documentElement.style.setProperty('--sand-opacity', getSandOpacity(hours, oceanB));
  }
}

// ── Time detection ───────────────────────────────────────────────────────────

function getTimeOfDayFromHour(h) {
  if (h < 2)    return 'midnight';
  if (h < 5)    return 'night';
  if (h < 7)    return 'dawn';
  if (h < 17)   return 'day';
  if (h < 20)   return 'dusk';
  if (h <= 22)  return 'night';
  return 'midnight';
}

function getTimeOfDay() {
  return getTimeOfDayFromHour(new Date().getHours());
}

/** Returns seconds-since-midnight for sun/moon math. */
function getSecondsNow() {
  const now = new Date();
  return now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
}

/** Seconds-since-midnight used when a toggle button is pressed. */
const TOGGLE_TIMES = {
  dawn:    21600,   // 06:00 — pure dawn sky
  morning: 43200,   // 12:00 — noon, sun at apex
  evening: 64800,   // 18:00 — 6 pm, dusk
  night:       0,   // 00:00 — midnight, moon at apex
};

// true while the user has manually selected a theme — auto-updates are suppressed.
let manualOverride = false;

// Holds the ClockScrubber instance so intervals can check its active state.
let clockScrubber = null;

// Tracks the currently displayed ocean theme so we crossfade only on boundary crossings.
let currentOceanTheme = null;

// ── Apply theme ──────────────────────────────────────────────────────────────

const SAND_OPACITY = { dawn: 1.0, day: 1.0, dusk: 0.9, evening: 0.65, night: 0.35, midnight: 0.15 };

/** Returns the interpolated sand opacity for the given hour, using the ocean segment table. */
function getSandOpacity(hours, blend) {
  const { from, to, t } = blend || getOceanBlend(hours);
  return +(SAND_OPACITY[from] + (SAND_OPACITY[to] - SAND_OPACITY[from]) * t).toFixed(3);
}

// Star visibility: 0 = fully hidden (day), 1 = fully shown (midnight).
// Uses the sky segment table so it tracks the gradient crossfade exactly.
const STAR_VISIBILITY = { dawn: 0.05, day: 0.0, dusk: 0.40, evening: 0.80, night: 0.95, midnight: 1.0 };

/** Returns the interpolated star visibility multiplier for the given hour. */
function getStarVisibility(hours, blend) {
  const { from, to, t } = blend || getSkyBlend(hours);
  return +(STAR_VISIBILITY[from] + (STAR_VISIBILITY[to] - STAR_VISIBILITY[from]) * t).toFixed(3);
}


// ── Dynamic favicon ──────────────────────────────────────────────────────────
// Offscreen 32x32 canvas reused for every repaint -- no DOM allocation per frame.
const _faviconLink = document.querySelector('link[rel="icon"][type="image/svg+xml"]');
const _faviconCanvas = document.createElement('canvas');
_faviconCanvas.width = _faviconCanvas.height = 32;
const _faviconCtx = _faviconCanvas.getContext('2d');

function _getFaviconType(hours) {
  const h = ((hours % 24) + 24) % 24;
  if (h >= 7  && h < 17) return 'sun';
  if (h >= 5  && h < 7)  return 'halfsun';
  if (h >= 17 && h < 20) return 'halfsun';
  if (h >= 20 && h < 22) return 'waxing';
  if (h >= 22 || h <  2) return 'full';
  return 'waning';
}

const _FAVICON_BG = { sun:'#096dd9', halfsun:'#0c3575', waxing:'#1a0c3a', full:'#000810', waning:'#1a0c3a' };

function _setFavicon(hours) {
  if (!_faviconLink) return;
  const W = 32, cx = W/2, cy = W/2;
  const type = _getFaviconType(hours);
  const ctx = _faviconCtx;
  ctx.clearRect(0, 0, W, W);
  ctx.fillStyle = _FAVICON_BG[type];
  ctx.fillRect(0, 0, W, W);

  if (type === 'sun' || type === 'halfsun') {
    const oy  = type === 'sun' ? cy : W;
    const r   = W * 0.22, outerR = W * 0.43;
    ctx.lineWidth = W * 0.07; ctx.lineCap = 'round'; ctx.strokeStyle = '#fff';
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx + (r + W * 0.07) * Math.cos(a), oy + (r + W * 0.07) * Math.sin(a));
      ctx.lineTo(cx + outerR * Math.cos(a),           oy + outerR * Math.sin(a));
      ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(cx, oy, r, 0, Math.PI * 2);
    ctx.fillStyle = '#fff'; ctx.fill();

  } else if (type === 'full') {
    const r = W / 2 - Math.round(W * 0.09);
    ctx.beginPath(); ctx.arc(cx, cy, r + W * 0.09, 0, Math.PI * 2);
    ctx.strokeStyle = '#fff'; ctx.globalAlpha = 0.28;
    ctx.lineWidth = W * 0.04; ctx.stroke(); ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = '#fff'; ctx.fill();

  } else {
    const phase = type === 'waxing' ? 0.30 : 0.70;
    const r     = W / 2 - Math.round(W * 0.09);
    const termX = r * Math.cos(phase * 2 * Math.PI), tx = Math.abs(termX);
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = '#fff'; ctx.beginPath();
    if (phase <= 0.5) {
      ctx.arc(cx, cy, r, -Math.PI / 2, Math.PI / 2, false);
      ctx.ellipse(cx, cy, tx, r, 0, Math.PI / 2, -Math.PI / 2, termX > 0);
    } else {
      ctx.arc(cx, cy, r, Math.PI / 2, -Math.PI / 2, false);
      ctx.ellipse(cx, cy, tx, r, 0, -Math.PI / 2, Math.PI / 2, termX > 0);
    }
    ctx.closePath(); ctx.fill(); ctx.restore();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = '#fff'; ctx.globalAlpha = 0.18; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Remove all existing favicon links and append a fresh one so every
  // browser (Chrome, Safari) reliably picks up the change.
  document.querySelectorAll('link[rel="icon"]').forEach(l => l.remove());
  const _favEl   = document.createElement('link');
  _favEl.rel     = 'icon';
  _favEl.type    = 'image/png';
  _favEl.href    = _faviconCanvas.toDataURL('image/png');
  document.head.appendChild(_favEl);
}

/** Syncs all theme-color meta tags (toolbar on iOS/Android) to the current pulldown colour. */
function _setThemeColor(color) {
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.setAttribute('content', color));
}

/**
 * Applies discrete theme CSS props and gradient outputs.
 * skyHours: if provided, builds gradients for that specific hour;
 * otherwise uses the theme's representative hour from THEME_HOURS.
 */
function applyTheme(themeKey, skyHours) {
  const th  = THEMES[themeKey];
  const hrs = skyHours !== undefined ? skyHours : THEME_HOURS[themeKey];
  document.documentElement.style.setProperty('--pulldown',    th.pulldown);
  document.documentElement.style.setProperty('--ocean-floor', th.oceanFloor);
  _setThemeColor(th.pulldown);
  _setFavicon(hrs);
  applyGradients(hrs);  // applyGradients handles --sand-opacity continuously
}

// ── Moon phase ───────────────────────────────────────────────────────────────

/**
 * Returns the current lunar phase as a value in [0, 1).
 * 0 = new moon, 0.25 = first quarter, 0.5 = full moon, 0.75 = last quarter.
 * Reference new moon: 6 January 2000, 18:14 UTC.
 */
function getMoonPhase() {
  if (DEV && devMoonPhase !== null) return devMoonPhase;
  const refNewMoon = Date.UTC(2000, 0, 6, 18, 14, 0);
  const synodicMs  = 29.530588853 * 24 * 60 * 60 * 1000;
  const elapsed    = Date.now() - refNewMoon;
  return ((elapsed % synodicMs) + synodicMs) % synodicMs / synodicMs;
}

/**
 * Draws the lunar phase onto a canvas.
 * phase: 0 = new, 0.25 = first quarter, 0.5 = full, 0.75 = last quarter.
 */
function drawMoonPhase(canvas, phase) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const cx = W / 2, cy = H / 2, r = Math.min(W, H) / 2 - 6;
  const illum = (1 - Math.cos(phase * Math.PI * 2)) / 2;

  if (illum < 0.01) return;

  // Smooth disc outline
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(190, 210, 245, 0.13)';
  ctx.lineWidth   = 1;
  ctx.stroke();

  const termX    = r * Math.cos(phase * 2 * Math.PI);
  const tx       = Math.abs(termX);
  const litColor = 'rgba(218, 228, 242, 0.94)';

  ctx.save();                              // save A — lit area clip
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();

  ctx.fillStyle = litColor;
  ctx.beginPath();
  if (phase <= 0.5) {
    ctx.arc(cx, cy, r, -Math.PI / 2, Math.PI / 2, false);
    ctx.ellipse(cx, cy, tx, r, 0, Math.PI / 2, -Math.PI / 2, termX > 0);
  } else {
    ctx.arc(cx, cy, r, Math.PI / 2, -Math.PI / 2, false);
    ctx.ellipse(cx, cy, tx, r, 0, -Math.PI / 2, Math.PI / 2, termX > 0);
  }
  ctx.closePath();
  ctx.fill();

  // Soft inner glow — already clipped to moon disc by save A.
  const glow = ctx.createRadialGradient(cx, cy, r * 0.35, cx, cy, r);
  glow.addColorStop(0, `rgba(190, 210, 240, ${(illum * 0.28).toFixed(3)})`);
  glow.addColorStop(1, 'rgba(190, 210, 240, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  ctx.restore();                           // restore A
}

// ── Sun / Moon arc ───────────────────────────────────────────────────────────

let _lastDrawnMoonPhase = -1;

// TODO: atmospheric scattering -- tint the sun via --sun-color based on arc position t
// (white at zenith t=0.5, amber near horizon t~0 or t~1). No canvas needed; just a
// CSS variable updated here alongside --sun-left/--sun-top.
function placeSunMoon(secondsSinceMidnight) {
  window._currentSecs = secondsSinceMidnight; // read by planets.js
  const dayPct = (secondsSinceMidnight / 43200) * 100;

  const HORIZON_Y = 22, PEAK_Y = 9, ARC_H = HORIZON_Y - PEAK_Y;
  const X_RISE = -12, X_SET = 112;
  const arcX = t => X_RISE + (X_SET - X_RISE) * t;
  const arcY = t => HORIZON_Y - ARC_H * Math.sin(Math.PI * t);

  const sun        = _el.sun;
  const moonCanvas = _el.moon;
  if (!sun || !moonCanvas) return;

  if (DEV && devMoonPhase !== null) {
    sun.style.setProperty('--sun-vis', 'hidden');
    moonCanvas.style.visibility = 'visible';
    moonCanvas.style.left = '50%';
    moonCanvas.style.top  = arcY(0.5) + '%';
    drawMoonPhase(moonCanvas, devMoonPhase);
    return;
  }

  if (dayPct >= 51 && dayPct <= 149) {
    const t = (dayPct - 51) / 98;
    sun.style.setProperty('--sun-vis',  'visible');
    sun.style.setProperty('--sun-left', arcX(t) + '%');
    sun.style.setProperty('--sun-top',  arcY(t) + '%');
    moonCanvas.style.visibility = 'hidden';
    _lastDrawnMoonPhase = -1;
  } else if (dayPct <= 49 || dayPct >= 151) {
    const moonPct = dayPct >= 151 ? dayPct : dayPct + 200;
    const t = (moonPct - 151) / 98;
    moonCanvas.style.visibility = 'visible';
    moonCanvas.style.left = arcX(t) + '%';
    moonCanvas.style.top  = arcY(t) + '%';
    // Skip canvas redraw while user is actively dragging — position still updates.
    // On release, the next second-interval tick will repaint the phase correctly.
    const phase   = getMoonPhase();
    const rounded = Math.round(phase * 10000) / 10000;
    const dragging = clockScrubber && clockScrubber.active;
    if (!dragging && rounded !== _lastDrawnMoonPhase) {
      _lastDrawnMoonPhase = rounded;
      drawMoonPhase(moonCanvas, phase);
    }
    sun.style.setProperty('--sun-vis', 'hidden');
  } else {
    sun.style.setProperty('--sun-vis',  'hidden');
    moonCanvas.style.visibility = 'hidden';
  }
}

// ── URL sanitiser ────────────────────────────────────────────────────────────

function safeHref(href) {
  try {
    const url = new URL(href, location.href);
    return ['https:', 'http:', 'mailto:'].includes(url.protocol) ? href : '#';
  } catch { return '#'; }
}

// ── Render content from content.js ───────────────────────────────────────────

function renderContent() {
  const C = window.CONTENT;
  if (!C) return;

  const nameEl    = document.getElementById('hero-name');
  const taglineEl = document.getElementById('hero-tagline');
  if (nameEl)    nameEl.textContent    = C.name;
  if (taglineEl) taglineEl.textContent = C.tagline;

  const iconsEl = document.getElementById('hero-icons');
  if (iconsEl) {
    iconsEl.innerHTML = C.links.map(l => {
      const safe  = safeHref(l.href);
      const isExt = !l.href.startsWith('mailto:');
      const rel   = isExt ? 'target="_blank" rel="noopener noreferrer"' : '';
      return '<a href="' + safe + '"' + (rel ? ' ' + rel : '') + ' aria-label="' + l.label + '"><img src="' + l.img + '" alt="' + l.label + '"></a>';
    }).join('');
  }

  const bioEl = document.getElementById('ocean-bio');
  if (bioEl) bioEl.innerHTML = C.bio;

  const statusEl = document.getElementById('status-cards');
  if (statusEl) {
    statusEl.innerHTML = C.statusCards.map(c =>
      '<div class="glass-card">' +
        '<div class="card-label">' + c.label + '</div>' +
        '<div class="card-title">' + c.title + '</div>' +
        '<div class="card-sub">'   + c.body  + '</div>' +
      '</div>'
    ).join('');
  }

  const projEl = document.getElementById('project-cards');
  if (projEl) {
    projEl.innerHTML = C.projects.map(p => {
      const cls  = p.href ? 'glass-card glass-card--link' : 'glass-card';
      const tag  = p.href ? 'a' : 'div';
      const attr = p.href
        ? 'href="' + safeHref(p.href) + '" target="_blank" rel="noopener noreferrer"'
        : '';
      return '<' + tag + ' class="' + cls + '" ' + attr + '>' +
               '<div class="card-title">' + p.title + '</div>' +
               '<div class="card-sub">'   + p.body  + '</div>' +
             '</' + tag + '>';
    }).join('');
  }

  const alsoEl = document.getElementById('also-cards');
  if (alsoEl) {
    alsoEl.innerHTML = C.also.map(a =>
      '<div class="glass-card glass-card--small">' +
        '<div class="card-title">' + a.title + '</div>' +
        (a.body ? '<div class="card-sub">' + a.body + '</div>' : '') +
      '</div>'
    ).join('');
  }

  const ftEl = document.getElementById('footer-text');
  if (ftEl) {
    ftEl.textContent = C.footerText;
    // Visitor counter -- fetch after rendering base text
    fetch('https://api.jordanfluitt.com/visits')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data && typeof data.count === 'number' && ftEl) {
          ftEl.textContent = C.footerText + '  ·  ' + data.count.toLocaleString() + ' visits';
        }
      })
      .catch(() => { /* counter unavailable -- fail silently */ });
  }
}

// ── Time toggle ──────────────────────────────────────────────────────────────

function initToggle() {
  document.querySelectorAll('.time-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const t        = btn.dataset.time;
      const themeMap = { dawn: 'dawn', morning: 'day', evening: 'dusk', night: 'midnight' };
      const themeKey = themeMap[t];
      const secs     = TOGGLE_TIMES[t];
      const hours    = secs / 3600;
      manualOverride = true;
      applyTheme(themeKey, hours);
      placeSunMoon(secs);
      if (clockScrubber) {
        clockScrubber._overriding = true;
        clockScrubber._lastTheme  = null;
        clockScrubber.secs        = secs;
        clockScrubber.draw();
      }
      if (_el.restore) _el.restore.classList.add('visible');
    });
  });
}

// ── Clock scrubber ───────────────────────────────────────────────────────────

class ClockScrubber {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx         = this.canvas.getContext('2d');
    this.secs        = getSecondsNow();
    this.active      = false;
    this._overriding = false;
    this._lastTheme  = null;
    this._dateOffset = 0;
    this._prevSecs   = this.secs;
    this._pendingX   = 0;
    this._pendingY   = 0;
    this._rafId      = null;

    // Scale canvas buffer for device pixel ratio so it stays crisp on retina/mobile
    const _dpr = window.devicePixelRatio || 1;
    this._dpr  = _dpr;
    const W    = this.canvas.width;  // logical width (140) — read before we overwrite it
    this._logW = W;
    this.canvas.width  = W * _dpr;
    this.canvas.height = W * _dpr;
    this.ctx.scale(_dpr, _dpr);

    this._handWidth  = Math.max(2, Math.round(W * 0.022));
    this._handGapR   = Math.round(W * 0.17);
    this._fontSize   = Math.round(W * 0.10);
    this._fontString = '500 ' + this._fontSize + 'px Montserrat, sans-serif';

    const ev = e => e.touches ? e.touches[0] : e;
    this.canvas.addEventListener('mousedown',  e => this._down(ev(e)));
    this.canvas.addEventListener('touchstart', e => this._down(ev(e)), { passive: false });
    window.addEventListener('mousemove',  e => this._move(ev(e)));
    window.addEventListener('touchmove',  e => { if (this.active) { e.preventDefault(); this._move(ev(e)); } }, { passive: false });
    // On release: always clear scrubbing state first so it can never get stuck
    // (e.g. if the Restore button resets this.active before mouseup fires).
    const _onRelease = () => {
      window._scrubbing = false;
      document.documentElement.classList.remove('scrubbing');
      if (!this.active) return;
      this.active = false;
      requestAnimationFrame(() => applyGradients(this.secs / 3600));
    };
    window.addEventListener('mouseup',  _onRelease);
    window.addEventListener('touchend', _onRelease);

    if (_el.restore) {
      _el.restore.addEventListener('click', () => {
        const now         = getSecondsNow();
        _el.restore.classList.remove('visible');
        this.active       = false;
        window._scrubbing = false;
        document.documentElement.classList.remove('scrubbing');
        this._overriding  = false;
        this._lastTheme   = null;
        this._dateOffset    = 0;
        this._prevSecs      = now;
        window._currentDate = null;
        this._updateDatePill();
        this.secs         = now;
        this.draw();
        manualOverride    = false;
        const themeKey    = getTimeOfDay();
        currentOceanTheme = themeKey;
        applyTheme(themeKey, now / 3600);
        placeSunMoon(now);
      });
    }

    this.draw();
  }

  _angle(s) {
    return (s / 86400) * Math.PI * 2 - Math.PI / 2;
  }

  _secsFromPoint(clientX, clientY) {
    const r  = this._canvasRect || this.canvas.getBoundingClientRect();
    const dx = clientX - (r.left + r.width  / 2);
    const dy = clientY - (r.top  + r.height / 2);
    let   a  = Math.atan2(dy, dx) + Math.PI / 2;
    if (a < 0) a += Math.PI * 2;
    return (a / (Math.PI * 2)) * 86400;
  }

  _down(e) {
    this.active        = true;
    this._canvasRect   = this.canvas.getBoundingClientRect();
    window._scrubbing  = true;
    document.documentElement.classList.add('scrubbing');
    this._pendingX = e.clientX;
    this._pendingY = e.clientY;
    this._scheduleProcess();
  }

  _move(e) {
    if (!this.active) return;
    this._pendingX = e.clientX;
    this._pendingY = e.clientY;
    this._scheduleProcess();
  }

  _scheduleProcess() {
    if (this._rafId) return;
    this._rafId = requestAnimationFrame(() => {
      this._rafId = null;
      this._process();
    });
  }

  _process() {
    const _prev   = this._prevSecs;
    this.secs     = this._secsFromPoint(this._pendingX, this._pendingY);
    this._prevSecs = this.secs;

    // Detect midnight crossings: a jump > 12 hours means the hand crossed midnight.
    // Forward (clockwise, ~23:59 → 00:00): delta is large negative  → offset +1
    // Backward (counter-clockwise, 00:00 → ~23:59): delta is large positive → offset -1
    const _delta = this.secs - _prev;
    if (_delta < -43200)      this._dateOffset += 1;
    else if (_delta > 43200)  this._dateOffset -= 1;
    window._currentDate = this._getOffsetDate();
    this._updateDatePill();

    this.draw();
    const hours = this.secs / 3600;
    placeSunMoon(this.secs);
    if (window._planetRenderer) window._planetRenderer.drawNow();

    applyGradients(hours);

    const theme = getTimeOfDayFromHour(hours);
    if (theme !== this._lastTheme) {
      this._lastTheme   = theme;
      currentOceanTheme = theme;
      const th = THEMES[theme];
      document.documentElement.style.setProperty('--pulldown',    th.pulldown);
      document.documentElement.style.setProperty('--ocean-floor', th.oceanFloor);
      _setThemeColor(th.pulldown);
      _setFavicon(hours);
    }

    const realSecs = getSecondsNow();
    let diff = Math.abs(this.secs - realSecs);
    if (diff > 43200) diff = 86400 - diff;
    const deviated   = diff >= 120;
    this._overriding = deviated;
    if (!deviated) manualOverride = false;
    if (_el.restore) {
      if (deviated) _el.restore.classList.add('visible');
      else          _el.restore.classList.remove('visible');
    }
  }

  _getOffsetDate() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + this._dateOffset);
    return d;
  }

  _updateDatePill() {
    const el = _el.scrubberDate;
    if (!el) return;
    if (this._dateOffset === 0) {
      el.classList.remove('visible');
    } else {
      const d = this._getOffsetDate();
      el.textContent = d.toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric'
      });
      el.classList.add('visible');
    }
  }

  draw() {
    const { canvas, ctx } = this;
    const W  = this._logW, H = this._logW;
    const cx = W / 2, cy = H / 2;
    const R  = W / 2 - 5;
    const TR = R - 9;

    ctx.clearRect(0, 0, W, H);

    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.52)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Minor ticks — one batched path instead of 20 individual strokes
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth   = 1;
    for (let h = 0; h < 24; h++) {
      if (h % 6 === 0) continue;
      const a = (h / 24) * Math.PI * 2 - Math.PI / 2;
      ctx.moveTo(cx + (R - 5) * Math.cos(a), cy + (R - 5) * Math.sin(a));
      ctx.lineTo(cx + R * Math.cos(a),        cy + R * Math.sin(a));
    }
    ctx.stroke();
    // Major ticks (0, 6, 12, 18 h)
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth   = 1.5;
    for (let h = 0; h < 24; h += 6) {
      const a = (h / 24) * Math.PI * 2 - Math.PI / 2;
      ctx.moveTo(cx + (R - 9) * Math.cos(a), cy + (R - 9) * Math.sin(a));
      ctx.lineTo(cx + R * Math.cos(a),        cy + R * Math.sin(a));
    }
    ctx.stroke();

    const hh = String(Math.floor(this.secs / 3600)).padStart(2, '0');
    const mm = String(Math.floor((this.secs % 3600) / 60)).padStart(2, '0');
    ctx.fillStyle    = 'rgba(255,255,255,0.65)';
    ctx.font         = this._fontString;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(hh + ':' + mm, cx, cy);

    const a    = this._angle(this.secs);
    const tipX = cx + TR * Math.cos(a);
    const tipY = cy + TR * Math.sin(a);
    ctx.save();
    ctx.lineCap     = 'round';
    ctx.lineWidth   = this._handWidth;
    ctx.strokeStyle = '#fff';
    ctx.shadowColor = 'rgba(255,255,255,0.55)';
    ctx.shadowBlur  = 6;
    ctx.beginPath();
    ctx.moveTo(cx + this._handGapR * Math.cos(a), cy + this._handGapR * Math.sin(a));
    ctx.lineTo(tipX, tipY);
    ctx.stroke();
    ctx.restore();
  }
}

/**
 * Sizes the gradient canvas to match sky-hero and repaints.
 * Called at boot and on window resize.
 */
function _resizeGradientCanvas() {
  if (!_el.gradientCanvas || !_el.sky) return;
  _el.gradientCanvas.width  = _el.sky.offsetWidth;
  _el.gradientCanvas.height = _el.sky.offsetHeight;
  const secs  = clockScrubber ? clockScrubber.secs : getSecondsNow();
  const hours = secs / 3600;
  paintSkyGradient(hours, getSkyBlend(hours));
}

// ── Boot ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  _el.sky            = document.getElementById('sky-hero');
  _el.gradientCanvas = document.getElementById('gradient-canvas');
  _el.gradientCtx    = _el.gradientCanvas ? _el.gradientCanvas.getContext('2d') : null;
  _el.surface        = document.getElementById('sky-surface');
  _el.ocean          = document.getElementById('ocean');
  _el.footer         = document.getElementById('footer');
  _el.restore        = document.getElementById('scrubber-restore');
  _el.scrubberDate   = document.getElementById('scrubber-date');
  _el.sun            = document.getElementById('sun');
  _el.moon           = document.getElementById('moon-canvas');
  _el.wavePaths      = Array.from(document.querySelectorAll('.wave-path'));

  renderContent();

  currentOceanTheme = getTimeOfDay();
  const _bootSecs  = getSecondsNow();
  const _bootTheme = THEMES[currentOceanTheme];
  document.documentElement.style.setProperty('--pulldown',    _bootTheme.pulldown);
  document.documentElement.style.setProperty('--ocean-floor', _bootTheme.oceanFloor);
  _setThemeColor(_bootTheme.pulldown);
  _setFavicon(_bootSecs / 3600);
  // Lock sky height to the initial viewport — prevents iOS nav-bar resize from reflowing the sky.
  document.documentElement.style.setProperty('--sky-h', window.innerHeight + 'px');
  _resizeGradientCanvas();           // sizes canvas before first paint
  applyGradients(_bootSecs / 3600);  // single paint on a correctly-sized canvas
  placeSunMoon(_bootSecs);

  setInterval(() => {
    if (manualOverride) return;
    if (clockScrubber && (clockScrubber.active || clockScrubber._overriding)) return;

    const secs     = getSecondsNow();
    const hours    = secs / 3600;
    const themeKey = getTimeOfDayFromHour(hours);

    applyGradients(hours);

    if (themeKey !== currentOceanTheme) {
      currentOceanTheme = themeKey;
      const t = THEMES[themeKey];
      document.documentElement.style.setProperty('--pulldown',    t.pulldown);
      document.documentElement.style.setProperty('--ocean-floor', t.oceanFloor);
      _setThemeColor(t.pulldown);
      _setFavicon(hours);
    }
  }, 60000);

  setInterval(() => {
    if (manualOverride) return;
    if (clockScrubber && (clockScrubber.active || clockScrubber._overriding)) return;
    const secs = getSecondsNow();
    placeSunMoon(secs);
    if (clockScrubber) { clockScrubber.secs = secs; clockScrubber.draw(); }
  }, 1000);

  initToggle();

  window.addEventListener('resize', () => {
    _resizeGradientCanvas();
    // Respect manual override -- iOS fires resize when nav bars show/hide,
    // which would otherwise snap the sun/moon back to real time.
    const _rsecs = (manualOverride && clockScrubber) ? clockScrubber.secs : getSecondsNow();
    placeSunMoon(_rsecs);
    if (clockScrubber) clockScrubber._canvasRect = null;
  });

  new SkyParticles('sky-canvas');
  new BubbleParticles('bubbles-canvas');

  clockScrubber = new ClockScrubber('clock-canvas');

  // ── Scrubber collapse toggle ──────────────────────────────────────────────
  const _scrubToggle = document.getElementById('scrubber-toggle');
  if (_scrubToggle) {
    const _CKEY = 'scrubberCollapsed';
    const _applyCollapse = collapsed => {
      const tc = document.getElementById('time-controls');
      if (tc) tc.classList.toggle('scrubber-collapsed', collapsed);
      _scrubToggle.title = collapsed ? 'Show clock' : 'Hide clock';
      // Arrow rotation is handled by CSS .scrubber-collapsed .toggle-arrow
    };
    // On mobile (<600px) default to collapsed if the user has never set a preference.
    const _stored = localStorage.getItem(_CKEY);
    const _defaultCollapsed = _stored !== null ? _stored === '1' : window.innerWidth < 600;
    // Apply initial state before first paint -- js-ready enables transitions after.
    _applyCollapse(_defaultCollapsed);
    const _tc = document.getElementById('time-controls');
    // Double rAF: first fires before paint, second fires after -- safe to enable transitions.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (_tc) _tc.classList.add('js-ready');
    }));
    _scrubToggle.addEventListener('click', () => {
      const tc        = document.getElementById('time-controls');
      if (tc) tc.classList.add('user-interacted'); // enable transitions from first click onward
      const collapsed = tc ? !tc.classList.contains('scrubber-collapsed') : false;
      _applyCollapse(collapsed);
      localStorage.setItem(_CKEY, collapsed ? '1' : '0');
    });
  }

  // ── Mobile controls toggle ──────────────────────────────────────────────
  const _controlsToggle = document.getElementById('controls-toggle');
  if (_controlsToggle) {
    const _ctc = document.getElementById('time-controls');
    _controlsToggle.addEventListener('click', () => {
      const expanded = _ctc ? _ctc.classList.toggle('controls-expanded') : false;
      _controlsToggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    });
  }

  if (DEV) {
    const _DEV_PHASES = [
      { phase: 0,      label: 'New Moon'        },
      { phase: 0.125,  label: 'Waxing Crescent' },
      { phase: 0.25,   label: 'First Quarter'   },
      { phase: 0.375,  label: 'Waxing Gibbous'  },
      { phase: 0.5,    label: 'Full Moon'        },
      { phase: 0.625,  label: 'Waning Gibbous'  },
      { phase: 0.75,   label: 'Last Quarter'     },
      { phase: 0.875,  label: 'Waning Crescent'  },
      { phase: null,   label: 'Real Phase'       },
    ];

    let _labelTimer = null;

    function _showPhaseLabel(text) {
      let el = document.getElementById('dev-phase-label');
      if (!el) {
        el = document.createElement('div');
        el.id = 'dev-phase-label';
        el.style.cssText = [
          'position:fixed', 'bottom:1.5rem', 'left:50%',
          'transform:translateX(-50%)',
          'background:rgba(0,0,0,0.62)',
          'border:1px solid rgba(255,255,255,0.14)',
          'color:rgba(255,255,255,0.82)',
          'font:700 0.68rem/1 Montserrat,sans-serif',
          'letter-spacing:0.13em', 'text-transform:uppercase',
          'padding:0.38rem 0.9rem', 'border-radius:999px',
          'pointer-events:none', 'z-index:999',
          'transition:opacity 0.3s ease',
        ].join(';');
        document.body.appendChild(el);
      }
      el.textContent   = text;
      el.style.opacity = '1';
      clearTimeout(_labelTimer);
      _labelTimer = setTimeout(() => { el.style.opacity = '0'; }, 1800);
    }

    document.addEventListener('keydown', e => {
      if (e.key === 'm' || e.key === 'M') {
        _devPhaseIdx = (_devPhaseIdx + 1) % _DEV_PHASES.length;
        const entry  = _DEV_PHASES[_devPhaseIdx];
        devMoonPhase = entry.phase;
        placeSunMoon(clockScrubber ? clockScrubber.secs : getSecondsNow());
        _showPhaseLabel(entry.label);
        return;
      }
      // [ / ] — step date back/forward one week (syncs scrubber date pill)
      if (e.key === '[' || e.key === ']') {
        const cs   = clockScrubber;
        if (!cs) return;
        const step = e.key === '[' ? -1 : 1;
        cs._dateOffset += step;
        cs._prevSecs    = cs.secs; // prevent false midnight-crossing on next drag
        window._currentDate = cs._getOffsetDate();
        cs._updateDatePill();
        if (window._planetRenderer) window._planetRenderer._lastPosUpdate = -Infinity;
      }
      // Escape or 0 — reset date to today
      if (e.key === 'Escape' || e.key === '0') {
        const cs = clockScrubber;
        if (!cs) return;
        cs._dateOffset  = 0;
        cs._prevSecs    = cs.secs;
        window._currentDate = null;
        cs._updateDatePill();
        if (window._planetRenderer) window._planetRenderer._lastPosUpdate = -Infinity;
      }
    });
  }
});
