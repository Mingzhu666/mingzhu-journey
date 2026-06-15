import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// The overhead stage spotlight is back in the overview scene — but only in
// its flicker-safe form. These tests pin the invariants that keep it from
// ever re-introducing the black-frame stall:
//   1. mounted exactly once (one shared rig, never per-station mount/unmount)
//   2. shaders prewarmed during load (no first-use compile mid-interaction)
//   3. no real THREE light (no forward-light-loop shader churn)
//   4. additive, non-depth-writing, non-tone-mapped overlay materials
//   5. draw calls skipped entirely once faded out (tour mode costs nothing)

const sceneSource = readFileSync(new URL('./Scene.jsx', import.meta.url), 'utf8');
const spotSource = readFileSync(new URL('./StageSpotlight.jsx', import.meta.url), 'utf8');

test('scene mounts the stage spotlight exactly once', () => {
  assert.match(sceneSource, /import\s+StageSpotlight\b/);
  const mounts = sceneSource.match(/<StageSpotlight\s*\/>/g) ?? [];
  assert.equal(mounts.length, 1);
});

test('spotlight prewarms its shaders behind the loading cover', () => {
  // A warmup window must exist and force the beam to draw (at intensity 0)
  // so the ShaderMaterials compile during load, not on first overview entry.
  assert.match(spotSource, /WARMUP_FRAMES\s*=\s*[1-9]/);
  assert.match(spotSource, /warmup\.current\s*>\s*0/);
  assert.match(spotSource, /visible\s*=\s*true/);
});

test('spotlight uses no real THREE light', () => {
  assert.doesNotMatch(spotSource, /<spotLight|<pointLight|<directionalLight|<rectAreaLight/i);
});

test('spotlight materials are flicker-safe overlay materials', () => {
  assert.match(spotSource, /blending:\s*THREE\.AdditiveBlending/);
  assert.match(spotSource, /depthWrite:\s*false/);
  assert.match(spotSource, /toneMapped:\s*false/);
});

test('spotlight skips its draw calls when faded out', () => {
  assert.match(spotSource, /DRAW_EPSILON/);
  assert.match(spotSource, /vis\s*>\s*DRAW_EPSILON/);
});

// Comments in the component legitimately mention "pow(negative" / "discard"
// while explaining the bugs — scan only the actual code.
const spotCode = spotSource
  .split('\n')
  .map((line) => line.replace(/\/\/.*$/, ''))
  .join('\n');

test('spotlight shaders are NaN-proof (the full-screen black-flash bug)', () => {
  // pow(negative, non-integer) is NaN on GPUs; one NaN alpha additively
  // blended into the HDR buffer gets smeared across whole bloom mips —
  // a full-screen black frame. Every pow() input must be clamped.
  const pows = spotCode.match(/pow\([^,]+,/g) ?? [];
  assert.ok(pows.length >= 2, 'expected the rim + disc pow() calls');
  for (const p of pows) {
    assert.match(p, /pow\(\s*clamp\(/, `unclamped pow() input: ${p}`);
  }
  // The facing term itself must also be clamped before the subtraction.
  assert.match(spotCode, /clamp\(abs\(dot\(/);
});

test('spotlight avoids GPU-hostile fragment paths', () => {
  // discard disables early-Z on tile-based (Apple) GPUs.
  assert.doesNotMatch(spotCode, /discard/);
  // DoubleSide doubles fragment cost for no visual gain here.
  assert.doesNotMatch(spotCode, /THREE\.DoubleSide/);
  assert.match(spotCode, /THREE\.FrontSide/);
});

test('spotlight waits for sceneReady and dims while driving', () => {
  assert.match(spotSource, /sceneReady/);
  assert.match(spotSource, /isDriving\s*\?\s*DRIVING_DIM\s*:\s*1/);
});
