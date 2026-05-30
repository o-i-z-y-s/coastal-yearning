/**
 * astronomy.js: Pure astronomical calculations. No DOM access.
 * Must be loaded before main.js.
 *
 * Exports (global):
 *   computeSolarTimes(date, latDeg, lonDeg)
 *     → { sunrise, sunset, solarNoon, sunElevNoon, twilight times [, polarDay | polarNight] }
 *
 *   computeMoonState(date, latDeg, lonDeg)
 *     → { up, hourAngle, riseSetHA, transitAlt }
 *
 * All times are seconds since local midnight (local clock, DST-aware).
 * Angles are degrees unless noted.
 *
 * Solar algorithm : Spencer (1971), accurate to ≈ 1 to 2 min below 60° lat.
 * Lunar algorithm : Meeus Ch. 47 truncated, accurate to ≈ 1° / a few minutes.
 *                   Sufficient for visual effects.
 */

'use strict';

(function () {

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

// ── Shared helper ─────────────────────────────────────────────────────────────

/** JS Date → Julian Day Number (UT). */
function _jd(date) {
  return date.getTime() / 86400000 + 2440587.5;
}

// ── Solar calculations ────────────────────────────────────────────────────────

/**
 * Computes sunrise, sunset, solar noon, and noon elevation for a given date.
 * @param {Date}   date   - Local calendar date
 * @param {number} latDeg - Latitude  in degrees (N positive)
 * @param {number} lonDeg - Longitude in degrees (E positive)
 */
function computeSolarTimes(date, latDeg, lonDeg) {

  // Day of year (1 to 366)
  const jan1      = new Date(date.getFullYear(), 0, 1);
  const dayOfYear = Math.round((date - jan1) / 86400000) + 1;

  // Fractional year (radians)
  const B = D2R * (360 / 365) * (dayOfYear - 1);

  // Solar declination (radians), per Spencer 1971
  const decl =
    0.006918
    - 0.399912 * Math.cos(B)     + 0.070257 * Math.sin(B)
    - 0.006758 * Math.cos(2 * B) + 0.000907 * Math.sin(2 * B)
    - 0.002697 * Math.cos(3 * B) + 0.001480 * Math.sin(3 * B);

  // Equation of time (minutes), per Spencer 1971
  const eqtMin =
    229.18 * (
        0.000075
      + 0.001868 * Math.cos(B)     - 0.032077 * Math.sin(B)
      - 0.014615 * Math.cos(2 * B) - 0.040890 * Math.sin(2 * B)
    );

  // Solar noon in local clock time (hours)
  const tzHrs        = -date.getTimezoneOffset() / 60;
  const solarNoonHrs = 12 + (tzHrs * 15 - lonDeg) / 15 - eqtMin / 60;

  // Elevation at solar noon (degrees)
  const sunElevNoon = 90 - Math.abs(latDeg - decl * R2D);

  // Hour angle at sunrise / sunset
  const latR  = latDeg * D2R;
  const cosH0 = -Math.tan(latR) * Math.tan(decl);

  if (cosH0 <= -1) {
    return { polarDay:   true, solarNoon: solarNoonHrs * 3600, sunElevNoon };
  }
  if (cosH0 >= 1) {
    return { polarNight: true, solarNoon: solarNoonHrs * 3600, sunElevNoon };
  }

  const halfDayHrs = Math.acos(cosH0) * R2D / 15;

  // Hours from solar noon until the sun reaches a given elevation
  // (degrees, negative = below horizon). null if it never reaches that elevation today.
  const halfArcTo = elevDeg => {
    const cosH = (Math.sin(elevDeg * D2R) - Math.sin(latR) * Math.sin(decl)) /
                 (Math.cos(latR) * Math.cos(decl));
    return (cosH < -1 || cosH > 1) ? null : Math.acos(cosH) * R2D / 15;
  };
  const civilH = halfArcTo(-6), nautH = halfArcTo(-12), astroH = halfArcTo(-18);
  const at = (hrs, sign) => hrs == null ? null : (solarNoonHrs + sign * hrs) * 3600;

  return {
    sunrise:    (solarNoonHrs - halfDayHrs) * 3600,
    sunset:     (solarNoonHrs + halfDayHrs) * 3600,
    solarNoon:  solarNoonHrs * 3600,
    sunElevNoon,
    // Real twilight crossings consumed by the segment table. Civil dawn folds into
    // the dawn band, so only the anchors actually used are returned.
    astronomicalDawn: at(astroH, -1),
    nauticalDawn:     at(nautH,  -1),
    civilDusk:        at(civilH, +1),
    nauticalDusk:     at(nautH,  +1),
    astronomicalDusk: at(astroH, +1),
  };
}

// ── Lunar calculations ────────────────────────────────────────────────────────

/**
 * Low-accuracy geocentric equatorial coordinates of the Moon.
 * Based on Meeus "Astronomical Algorithms" Ch. 47 (truncated series).
 * Returns { ra, dec } in degrees.
 */
function _moonEquatorial(jd) {
  const T = (jd - 2451545.0) / 36525.0;

  const n360 = x => ((x % 360) + 360) % 360;

  // Fundamental arguments (degrees, then converted per term)
  const L0 = n360(218.3165 + 481267.8813 * T); // mean longitude
  const D  = n360(297.8502 + 445267.1115 * T); // mean elongation
  const M  = n360(357.5291 +  35999.0503 * T); // sun's mean anomaly
  const Mp = n360(134.9634 + 477198.8676 * T); // moon's mean anomaly
  const F  = n360( 93.2721 + 483202.0175 * T); // argument of latitude

  // Pre-convert to radians for the sin calls
  const r = D2R;

  // Longitude perturbations (units: 0.001°)
  const sl =
    + 6288.774 * Math.sin(Mp * r)
    + 1274.027 * Math.sin((2*D - Mp) * r)
    +  658.314 * Math.sin(2*D * r)
    +  213.618 * Math.sin(2*Mp * r)
    -  185.116 * Math.sin(M * r)
    -  114.332 * Math.sin(2*F * r)
    +   58.793 * Math.sin((2*D - 2*Mp) * r)
    +   57.066 * Math.sin((2*D - M - Mp) * r)
    +   53.322 * Math.sin((2*D + Mp) * r)
    +   45.758 * Math.sin((2*D - M) * r)
    -   40.923 * Math.sin((Mp - M) * r)
    -   34.720 * Math.sin(D * r)
    -   30.383 * Math.sin((Mp + M) * r);

  // Latitude perturbations (units: 0.001°)
  const sb =
    + 5128.122 * Math.sin(F * r)
    +  280.602 * Math.sin((Mp + F) * r)
    +  277.693 * Math.sin((Mp - F) * r)
    +  173.237 * Math.sin((2*D - F) * r)
    +   55.413 * Math.sin((2*D - Mp + F) * r)
    +   46.272 * Math.sin((2*D - Mp - F) * r)
    +   32.573 * Math.sin((2*D + F) * r)
    +   17.198 * Math.sin((2*Mp + F) * r)
    +    9.266 * Math.sin((2*D + Mp - F) * r)
    +    8.822 * Math.sin((2*Mp - F) * r);

  // Ecliptic coordinates (degrees)
  const lam = L0 + sl / 1000; // longitude
  const bet = sb / 1000;      // latitude

  // Obliquity of ecliptic (degrees)
  const eps = 23.439291 - 0.013004 * T;

  // Ecliptic → equatorial
  const laR = lam * r, beR = bet * r, epR = eps * r;

  const sinDec      = Math.sin(beR)*Math.cos(epR) + Math.cos(beR)*Math.sin(epR)*Math.sin(laR);
  const cosDecSinRA = Math.cos(beR)*Math.cos(epR)*Math.sin(laR) - Math.sin(beR)*Math.sin(epR);
  const cosDecCosRA = Math.cos(beR)*Math.cos(laR);

  return {
    dec: Math.asin(Math.max(-1, Math.min(1, sinDec))) * R2D,
    ra:  (Math.atan2(cosDecSinRA, cosDecCosRA) * R2D + 360) % 360,
  };
}

/**
 * Instantaneous moon position for a given instant and observer. Continuous across
 * day boundaries (unlike per-day rise/set tables), so it drives a smooth arc.
 * Returns:
 *   up         - true when the moon is above the horizon
 *   hourAngle  - local hour angle in degrees, in [-180, 180): negative before
 *                transit (eastern sky), 0 at transit, positive after (western sky)
 *   riseSetHA  - |hour angle| at the horizon for the moon's declination (degrees)
 *   transitAlt - altitude at upper culmination (degrees); the arc's peak height
 */
function computeMoonState(date, latDeg, lonDeg) {
  const jd = _jd(date);
  const { ra, dec } = _moonEquatorial(jd);

  // Greenwich and local sidereal time (degrees), then hour angle in [-180, 180).
  const gmst = ((280.46061837 + 360.98564736629 * (jd - 2451545.0)) % 360 + 360) % 360;
  const lst  = ((gmst + lonDeg) % 360 + 360) % 360;
  const ha   = ((lst - ra) % 360 + 540) % 360 - 180;

  const latR = latDeg * D2R, decR = dec * D2R;
  const cosH0 = -Math.tan(latR) * Math.tan(decR);
  const transitAlt = Math.max(0, 90 - Math.abs(latDeg - dec)); // upper culmination

  if (cosH0 <= -1) return { up: true,  hourAngle: ha, riseSetHA: 180, transitAlt };  // circumpolar
  if (cosH0 >=  1) return { up: false, hourAngle: ha, riseSetHA: 0,   transitAlt: 0 }; // never up

  const H0 = Math.acos(cosH0) * R2D; // rise/set hour angle for altitude 0
  return { up: Math.abs(ha) < H0, hourAngle: ha, riseSetHA: H0, transitAlt };
}

// ── Exports ───────────────────────────────────────────────────────────────────

window.computeSolarTimes = computeSolarTimes;
window.computeMoonState = computeMoonState;

})();
