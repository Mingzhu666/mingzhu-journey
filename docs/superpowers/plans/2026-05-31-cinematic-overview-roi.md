# Cinematic Overview ROI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the first-screen overview feel more premium by increasing diorama visual weight and improving mobile framing.

**Architecture:** Extract overview camera math into a pure helper in `src/scene/overviewCamera.js`, test it with Node's built-in test runner, and consume it from `CameraRig.jsx`. Keep scene composition, station data, and tour behavior unchanged.

**Tech Stack:** React, React Three Fiber, Three.js, Vite, Node test runner.

---

## File Structure

- Create `src/scene/overviewCamera.js`: pure camera framing helper, no React dependency.
- Create `src/scene/overviewCamera.test.mjs`: tests for desktop and mobile framing decisions.
- Modify `src/scene/CameraRig.jsx`: use helper instead of hard-coded overview constants.
- Optionally modify `src/scene/PostFX.jsx` and `src/scene/Environment.jsx`: small clarity-only tuning if browser verification shows the tighter camera needs it.

## Task 1: Tested Overview Framing Helper

**Files:**
- Create: `src/scene/overviewCamera.js`
- Create: `src/scene/overviewCamera.test.mjs`
- Modify: `src/scene/CameraRig.jsx`

- [ ] **Step 1: Write failing tests**

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { getOverviewCameraFrame } from './overviewCamera.js';

test('desktop overview uses a tighter poster frame than the old wide shot', () => {
  const frame = getOverviewCameraFrame({ width: 1440, height: 900, fov: 38 });

  assert.equal(frame.span, 34);
  assert.equal(frame.lookY, 1.95);
  assert.equal(frame.focusStrength, 0);
  assert.ok(frame.distance < 31);
  assert.ok(frame.baseY > 5);
  assert.ok(frame.baseZ > 28);
});

test('mobile overview favors readable scale over preserving desktop distance', () => {
  const frame = getOverviewCameraFrame({ width: 390, height: 844, fov: 38 });

  assert.equal(frame.span, 18.5);
  assert.equal(frame.lookY, 0.95);
  assert.equal(frame.focusStrength, 0.82);
  assert.ok(frame.distance < 60);
  assert.ok(frame.baseY > 7);
  assert.ok(frame.baseZ > 40);
});

test('tablet-ish view blends between desktop and mobile rules', () => {
  const frame = getOverviewCameraFrame({ width: 820, height: 1180, fov: 38 });

  assert.ok(frame.span > 18.5);
  assert.ok(frame.span < 30.5);
  assert.ok(frame.lookY > 0.95);
  assert.ok(frame.lookY < 1.95);
  assert.ok(frame.focusStrength > 0);
  assert.ok(frame.focusStrength < 0.82);
});
```

- [ ] **Step 2: Run tests and verify red**

Run: `node --test src/scene/overviewCamera.test.mjs`

Expected: FAIL because `src/scene/overviewCamera.js` does not exist.

- [ ] **Step 3: Implement helper**

```js
export function getOverviewCameraFrame({ width, height, fov }) {
  const aspect = width / height;
  const narrow = clamp((0.95 - aspect) / 0.55, 0, 1);
  const span = lerp(34, 18.5, narrow);
  const tiltRad = lerp(degToRad(11.5), degToRad(8.5), narrow);
  const lookY = lerp(1.95, 0.95, narrow);
  const lookZ = lerp(-0.1, 0.55, narrow);
  const distance = span / 2 / (aspect * Math.tan(degToRad(fov) / 2));

  return {
    span: round1(span),
    tiltRad,
    lookY: round2(lookY),
    lookZ: round2(lookZ),
    focusStrength: round2(lerp(0, 0.82, narrow)),
    distance,
    baseY: distance * Math.sin(tiltRad),
    baseZ: distance * Math.cos(tiltRad),
  };
}

function degToRad(value) {
  return (value * Math.PI) / 180;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

function round2(value) {
  return Math.round(value * 100) / 100;
}
```

- [ ] **Step 4: Use helper in camera rig**

In `CameraRig.jsx`, import `getOverviewCameraFrame`, remove hard-coded `OVERVIEW_SPAN`, `OVERVIEW_TILT_RAD`, and `OVERVIEW_LOOK`, then in overview mode call:

```js
const frame = getOverviewCameraFrame({
  width: state.size.width,
  height: state.size.height,
  fov: camera.fov,
});

const time = state.clock.elapsedTime;
const sway = Math.sin(time * 0.1) * 0.42;
const tiltBob = Math.cos(time * 0.08) * 0.16;

_targetPos.set(sway, frame.baseY + tiltBob, frame.baseZ);
_carPos.copy(curve.getPoint(t));
_lookTarget.set(_carPos.x * 0.015, frame.lookY, frame.lookZ);
```

- [ ] **Step 5: Verify tests green**

Run: `node --test src/scene/overviewCamera.test.mjs`

Expected: PASS.

## Task 2: Browser Verification And Minimal Polish

**Files:**
- Modify only if needed: `src/scene/PostFX.jsx`
- Modify only if needed: `src/scene/Environment.jsx`

- [ ] **Step 1: Build**

Run: `npm run build`

Expected: exit 0.

- [ ] **Step 2: Capture desktop overview**

Open `http://localhost:5174/` at 1440x900. Expected: seven-station row is visibly larger and higher; black space is reduced.

- [ ] **Step 3: Capture mobile overview**

Open `http://localhost:5174/` at 390x844. Expected: diorama reads as a deliberate skyline, not a tiny strip at the bottom.

- [ ] **Step 4: Capture tour**

Switch to Tour. Expected: existing close-up composition remains strong and controls are usable.

- [ ] **Step 5: If tighter framing becomes too dark, make only small clarity tuning**

Allowed tuning:

```jsx
// App.jsx exposure may move from 0.76 to 0.82 if the tighter view is still too dim.
gl.toneMappingExposure = 0.82;
```

Avoid broad palette rewrites in this ROI pass.
