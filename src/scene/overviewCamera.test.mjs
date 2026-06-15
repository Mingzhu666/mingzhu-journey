import assert from 'node:assert/strict';
import test from 'node:test';
import { getOverviewCameraFrame } from './overviewCamera.js';

test('desktop overview stays poster-wide while sitting closer than the old wide shot', () => {
  const frame = getOverviewCameraFrame({ width: 1440, height: 900, fov: 38 });

  assert.equal(frame.span, 34);
  assert.equal(frame.lookY, 3.95);
  assert.equal(frame.focusStrength, 0);
  assert.ok(frame.distance < 31);
  assert.ok(frame.baseY > 5);
  assert.ok(frame.baseZ > 28);
});

test('mobile overview favors readable scale over preserving desktop distance', () => {
  const frame = getOverviewCameraFrame({ width: 390, height: 844, fov: 38 });

  assert.equal(frame.span, 18.5);
  assert.equal(frame.lookY, 2.95);
  assert.equal(frame.focusStrength, 0.82);
  assert.ok(frame.distance < 60);
  assert.ok(frame.baseY > 7);
  assert.ok(frame.baseZ > 40);
});

test('tablet-ish view blends between desktop and mobile rules', () => {
  const frame = getOverviewCameraFrame({ width: 820, height: 1180, fov: 38 });

  assert.ok(frame.span > 18.5);
  assert.ok(frame.span < 30.5);
  assert.ok(frame.lookY > 2.95);
  assert.ok(frame.lookY < 3.95);
  assert.ok(frame.focusStrength > 0);
  assert.ok(frame.focusStrength < 0.82);
});
