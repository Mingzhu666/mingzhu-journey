import * as THREE from 'three';
import { masterPath, stationTrackParam, STATION_COUNT } from './path.js';

// The car drives along a CatmullRomCurve3 built from a dense sampling
// of the master path. Why dense sampling instead of the seven station
// positions?
//
// Because the track is now SEPARATE from the stations — it winds
// through the foreground while stations sit in a row behind it. The
// curve has to follow the master path's full shape (broad sweeps,
// asymmetric waves, fine wiggles), not jump between station points.
//
// SAMPLES + 1 control points span the track end-to-end.
//
// stationT[k] is the parameter on the curve where the car PARKS to
// visit station k — computed by X-alignment so the car ends up
// directly in front of each platform, even though the platform itself
// is offset back from the rail.

const SAMPLES = 240;

const controlPoints = [];
for (let i = 0; i <= SAMPLES; i++) {
  controlPoints.push(masterPath(i / SAMPLES));
}

export const curve = new THREE.CatmullRomCurve3(
  controlPoints,
  false,
  'catmullrom',
  0.5,
);

export const stationT = Array.from(
  { length: STATION_COUNT },
  (_, i) => stationTrackParam(i),
);

// Cached samples for the visible track geometry (Track.jsx renders a
// tube + ties from these). 600 samples reads as perfectly smooth at
// any zoom we'd reasonably use.
export const trackSamples = curve.getPoints(600);

// Total arc length — useful for any future speed/distance calculations.
export const trackLength = curve.getLength();
