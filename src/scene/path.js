import * as THREE from 'three';
import { depthProfileForStation } from './stationVisuals.js';

// Two parametric curves drive the entire diorama:
//
//   • stationPosition(i) — where each platform sits. Stations form a
//     near-row at the back of the world (slightly negative Z), with a
//     small wiggle so they don't feel mechanical.
//
//   • masterPath(s) — the road the car drives along. This is now
//     SEPARATE from the stations: it winds through the foreground (more
//     positive Z), so when you watch the diorama you see the stations
//     behind the road, exactly like the reference diorama poster.
//
// Both functions take their parameter in [0, 1] going left → right.
//
// Why two curves instead of one running through stations? Composition.
// A road that passes through the buildings reads as "this is a corridor
// of buildings"; a road that snakes past them reads as "the buildings
// are landmarks along a journey". The second feel is much more
// portfolio-poster than tutorial-game.

export const STATION_COUNT = 7;

// --- Station row (just behind the road) ---
// Stations pulled closer together so each building occupies more of
// its allocated slot in the frame.
const STATION_X_MIN = -12.45;
const STATION_X_MAX = 12.45;
const STATION_Z_BASE = -0.8;
// Z-stagger: stations alternate between "front-row" and "back-row"
// depths. This creates parallax in the overview shot — closer buildings
// read larger, farther ones smaller — and uses the vertical screen
// space the camera would otherwise spend on empty sky.
const STATION_Z_WIGGLE = 0.72;

// --- Driving path (just in front of the stations) ---
// Sits roughly 2 units in front of the platforms so when the car
// parks it reads as "parallel-parked outside the entrance" instead of
// "passing through on a highway". Wave amplitudes are kept modest so
// the track never crosses behind a station.
const TRACK_X_MIN = -15.7;
const TRACK_X_MAX = 15.7;
// Pushed further forward so the road stays in front of even the closest
// (front-row) staggered stations. Front-row stations now sit at z ≈ 1,
// so 3.2 gives ~2 units of margin (and ~1 even after track wave dips
// it forward).
const TRACK_Z_BASE = 3.2;
const TRACK_Z_MAIN = 0.7;
const TRACK_Z_WAVE = 0.45;
const TRACK_Z_DETAIL = 0.18;

export function stationS(index) {
  return index / (STATION_COUNT - 1);
}

export function stationPosition(index) {
  const s = stationS(index);
  const x = STATION_X_MIN + (STATION_X_MAX - STATION_X_MIN) * s;
  const depth = depthProfileForStation(index);
  // Single low-frequency wave gives a subtle organic curve to the row.
  const z =
    STATION_Z_BASE +
    STATION_Z_WIGGLE * Math.sin(s * Math.PI * 3) +
    depth.zOffset;
  return new THREE.Vector3(x, 0, z);
}

export function masterPath(s) {
  const x = TRACK_X_MIN + (TRACK_X_MAX - TRACK_X_MIN) * s;
  const z =
    TRACK_Z_BASE +
    TRACK_Z_MAIN * Math.sin(s * Math.PI * 2.5 + 0.3) +
    TRACK_Z_WAVE * Math.cos(s * Math.PI * 4 + 0.8) +
    TRACK_Z_DETAIL * Math.sin(s * Math.PI * 9);
  // Very small vertical lift toward the middle.
  const y = 0.18 * Math.sin(s * Math.PI);
  return new THREE.Vector3(x, y, z);
}

// Maps station index → parameter `s` along the master path where the
// car parks to "visit" that station. Computed by X-alignment so the
// car ends up directly in front of each platform.
export function stationTrackParam(index) {
  const stationX =
    STATION_X_MIN + (STATION_X_MAX - STATION_X_MIN) * stationS(index);
  return (stationX - TRACK_X_MIN) / (TRACK_X_MAX - TRACK_X_MIN);
}
