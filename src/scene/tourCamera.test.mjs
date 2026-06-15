import assert from 'node:assert/strict';
import test from 'node:test';
import { getTourCameraFrame } from './tourCamera.js';

const FOV_RAD = (38 * Math.PI) / 180;

// Visible width at the station plane for a vertical-fov camera.
// Front-row stations sit ~1.7 closer to the camera than the car.
function visibleWidthAtStation({ distance }, aspect) {
  return 2 * Math.tan(FOV_RAD / 2) * (distance - 1.7) * aspect;
}

test('desktop landscape framing is exactly the original hand-tuned shot', () => {
  const parked = getTourCameraFrame({ aspect: 1440 / 900, isDriving: false, atWelcome: false });
  assert.equal(parked.fitK, 1);
  assert.equal(parked.distance, 7.0);
  assert.equal(parked.height, 4.2);
  assert.equal(parked.parkedLookY, 1.0);

  const welcome = getTourCameraFrame({ aspect: 1440 / 900, isDriving: false, atWelcome: true });
  assert.equal(welcome.distance, 7.8);
  assert.equal(welcome.height, 5.0);
  assert.equal(welcome.parkedLookY, 2.0);

  const driving = getTourCameraFrame({ aspect: 1440 / 900, isDriving: true, atWelcome: false });
  assert.equal(driving.distance, 9.5);
  assert.equal(driving.height, 5.0);
});

test('phone portrait pulls back far enough that a station model fits the width', () => {
  const aspect = 390 / 844; // iPhone-class portrait
  const frame = getTourCameraFrame({ aspect, isDriving: false, atWelcome: false });

  // Old fit (cap 1.7) framed only ~3.2 world units of width — buildings
  // are ~4 units wide with their tilt, so they cropped / read oversized.
  assert.ok(frame.fitK > 1.9, `fitK ${frame.fitK} should approach 1/aspect`);
  assert.ok(frame.fitK <= 2.1, 'fitK stays capped');
  assert.ok(
    visibleWidthAtStation(frame, aspect) > 3.9,
    `visible width ${visibleWidthAtStation(frame, aspect).toFixed(2)} should fit a ~4-unit-wide station`,
  );

  // Aim + camera rise so tall buildings center instead of cropping on top.
  assert.ok(frame.parkedLookY > 1.4);
  assert.ok(frame.height > 4.6);
});

test('welcome monitor (widest model) gets the strongest pull-back', () => {
  const aspect = 390 / 844;
  const welcome = getTourCameraFrame({ aspect, isDriving: false, atWelcome: true });
  const other = getTourCameraFrame({ aspect, isDriving: false, atWelcome: false });
  assert.ok(welcome.distance > other.distance);
  assert.ok(visibleWidthAtStation(welcome, aspect) > 4.4);
});

test('welcome aim stays locked to the focus-anchor height in portrait', () => {
  // The focus monitor centers on FOCUS_ANCHOR (y = 2.0); lifting the aim in
  // portrait pushed the panel below center on phones.
  const welcome = getTourCameraFrame({ aspect: 390 / 844, isDriving: false, atWelcome: true });
  assert.equal(welcome.parkedLookY, 2.0);
});

test('portrait welcome frame fits the focus monitor width', () => {
  // WelcomeMonitor portrait focus: screen 2.58 world units × scale 1.7 ≈ 4.39.
  const aspect = 390 / 844;
  const welcome = getTourCameraFrame({ aspect, isDriving: false, atWelcome: true });
  assert.ok(visibleWidthAtStation(welcome, aspect) > 2.58 * 1.7);
});

test('driving softens the pull-back so the car does not read tiny', () => {
  const aspect = 390 / 844;
  const driving = getTourCameraFrame({ aspect, isDriving: true, atWelcome: false });
  const parked = getTourCameraFrame({ aspect, isDriving: false, atWelcome: false });
  // Driving distance grows less (relative to its desktop 9.5) than parked
  // distance grows (relative to its desktop 7.0).
  assert.ok(driving.distance / 9.5 < parked.distance / 7.0);
  assert.ok(driving.distance / 9.5 > 1, 'still pulls back some in portrait');
});

test('fit is continuous at the portrait boundary (no jump at aspect 1)', () => {
  const just = getTourCameraFrame({ aspect: 0.999, isDriving: false, atWelcome: false });
  assert.ok(Math.abs(just.distance - 7.0) < 0.05);
  assert.ok(Math.abs(just.parkedLookY - 1.0) < 0.01);
});

test('tablet portrait gets a mild, in-between fit', () => {
  const frame = getTourCameraFrame({ aspect: 768 / 1024, isDriving: false, atWelcome: false });
  assert.ok(frame.fitK > 1.2);
  assert.ok(frame.fitK < 1.5);
});
