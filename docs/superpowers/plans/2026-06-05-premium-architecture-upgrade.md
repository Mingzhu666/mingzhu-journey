# Premium Architecture Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the 3D portfolio architecture feel premium while preserving every existing interaction.

**Architecture:** Add a small pure visual-spec module for deterministic architectural data, consume it from the existing React Three Fiber scene, and keep all state/overlay/car APIs untouched. Rebuild the distant skyline, refine station dressing, and improve material/light treatment in the current component boundaries.

**Tech Stack:** React 18, Vite, React Three Fiber, drei, Three.js, Node test runner.

---

## File Structure

- Create: `src/scene/architectureVisuals.js`
  - Pure deterministic skyline and station dressing data.
- Create: `src/scene/architectureVisuals.test.mjs`
  - Tests for skyline depth, silhouette variety, welcome-station clarity, and dressing palette rules.
- Modify: `src/scene/BackgroundCity.jsx`
  - Render the premium distant skyline from `architectureVisuals.js`.
- Modify: `src/scene/Scene.jsx`
  - Re-enable `BackgroundCity` after the rebuild.
- Modify: `src/scene/Stations.jsx`
  - Replace rough mini towers with refined micro-architecture and tune GLB material treatment.
- Modify: `src/scene/Environment.jsx`
  - Minor lighting/fog tuning only if needed for readability.
- Modify: `src/scene/Ground.jsx`
  - Minor stage glow tuning only if needed to integrate skyline and station plinths.

---

### Task 1: Add Architectural Visual Specs

**Files:**
- Create: `src/scene/architectureVisuals.test.mjs`
- Create: `src/scene/architectureVisuals.js`

- [ ] **Step 1: Write the failing test**

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getPremiumSkylineSpecs,
  getStationDressingSpecs,
} from './architectureVisuals.js';

test('premium skyline has layered varied silhouettes behind the station row', () => {
  const skyline = getPremiumSkylineSpecs();

  assert.equal(skyline.towers.length, 14);
  assert.ok(skyline.towers.every((tower) => tower.z <= -8.1));
  assert.ok(new Set(skyline.towers.map((tower) => tower.crown)).size >= 4);
  assert.ok(skyline.towers.some((tower) => tower.spire));
  assert.ok(skyline.towers.some((tower) => tower.setbacks.length >= 2));
  assert.ok(skyline.haze.width >= 44);
  assert.ok(skyline.windowSpecks.length >= 90);
});

test('station dressing keeps welcome clean and gives other stations architectural framing', () => {
  const welcome = getStationDressingSpecs({ id: 'welcome', index: 1, color: '#7dd3ff' });
  const finance = getStationDressingSpecs({ id: 'skills', index: 3, color: '#b6c6ff' });

  assert.deepEqual(welcome.structures, []);
  assert.deepEqual(welcome.pines, []);
  assert.equal(finance.structures.length, 6);
  assert.equal(finance.pines.length, 2);
  assert.ok(finance.structures.every((item) => item.height > 0.34));
  assert.ok(finance.structures.some((item) => item.crown === 'spire'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/scene/architectureVisuals.test.mjs`

Expected: FAIL with module-not-found for `architectureVisuals.js`.

- [ ] **Step 3: Implement the pure visual specs**

Create `src/scene/architectureVisuals.js` with:

```js
const SKYLINE_TOWERS = [
  { x: -18.4, z: -9.4, width: 0.92, depth: 0.56, height: 3.1, crown: 'needle', color: '#07111f', accent: '#7dd3ff', setbacks: [0.74, 0.52], spire: true },
  { x: -15.9, z: -8.8, width: 0.62, depth: 0.5, height: 2.0, crown: 'terrace', color: '#0a1628', accent: '#facc15', setbacks: [0.68], spire: false },
  { x: -13.7, z: -9.7, width: 1.05, depth: 0.62, height: 2.7, crown: 'lantern', color: '#081426', accent: '#38bdf8', setbacks: [0.72, 0.58], spire: false },
  { x: -11.2, z: -8.6, width: 0.52, depth: 0.46, height: 1.72, crown: 'flat', color: '#09172a', accent: '#93c5fd', setbacks: [], spire: false },
  { x: -8.9, z: -9.5, width: 0.82, depth: 0.54, height: 3.35, crown: 'deco', color: '#07111f', accent: '#fcd34d', setbacks: [0.76, 0.58, 0.42], spire: true },
  { x: -6.3, z: -8.7, width: 0.58, depth: 0.48, height: 2.18, crown: 'terrace', color: '#0b1830', accent: '#8db7ff', setbacks: [0.7], spire: false },
  { x: -3.6, z: -9.4, width: 0.96, depth: 0.6, height: 2.9, crown: 'lantern', color: '#081426', accent: '#a78bfa', setbacks: [0.78, 0.56], spire: false },
  { x: -0.9, z: -8.5, width: 0.48, depth: 0.42, height: 1.78, crown: 'flat', color: '#09172a', accent: '#60a5fa', setbacks: [], spire: false },
  { x: 1.7, z: -9.6, width: 0.78, depth: 0.55, height: 3.0, crown: 'needle', color: '#06111f', accent: '#7dd3ff', setbacks: [0.7, 0.5], spire: true },
  { x: 4.3, z: -8.7, width: 0.56, depth: 0.46, height: 1.92, crown: 'terrace', color: '#0a1628', accent: '#ff65f2', setbacks: [0.66], spire: false },
  { x: 6.9, z: -9.5, width: 1.04, depth: 0.62, height: 3.25, crown: 'deco', color: '#07111f', accent: '#fcd34d', setbacks: [0.8, 0.62, 0.48], spire: false },
  { x: 9.7, z: -8.6, width: 0.6, depth: 0.48, height: 2.18, crown: 'lantern', color: '#0b1830', accent: '#35b8ff', setbacks: [0.7], spire: false },
  { x: 12.3, z: -9.4, width: 0.84, depth: 0.56, height: 2.82, crown: 'needle', color: '#07111f', accent: '#8db7ff', setbacks: [0.72, 0.54], spire: true },
  { x: 15.2, z: -8.8, width: 0.68, depth: 0.5, height: 2.12, crown: 'terrace', color: '#09172a', accent: '#facc15', setbacks: [0.68], spire: false },
];

export function getPremiumSkylineSpecs() {
  return {
    haze: { width: 48, height: 7.2, position: [0, 2.3, -10.4] },
    towers: SKYLINE_TOWERS,
    windowSpecks: createWindowSpecks(SKYLINE_TOWERS),
  };
}

export function getStationDressingSpecs(station) {
  if (station.id === 'welcome') return { structures: [], pines: [] };

  const color = station.color ?? '#7dd3ff';
  const side = station.index % 2 === 0 ? -1 : 1;
  const structures = [
    { x: -1.54, z: -0.86, width: 0.28, depth: 0.24, height: 0.96, crown: 'terrace', color },
    { x: -1.26, z: 0.74, width: 0.22, depth: 0.2, height: 0.58, crown: 'flat', color },
    { x: 1.18, z: -0.9, width: 0.32, depth: 0.25, height: 1.18, crown: 'spire', color },
    { x: 1.48, z: 0.52, width: 0.22, depth: 0.19, height: 0.66, crown: 'lantern', color },
    { x: side * 0.86, z: -1.2, width: 0.24, depth: 0.2, height: 0.78, crown: 'deco', color },
    { x: side * 1.62, z: -0.12, width: 0.2, depth: 0.18, height: 0.64, crown: 'flat', color },
  ];

  return {
    structures,
    pines: [
      { x: -1.68, z: 1.08, height: 0.62 },
      { x: 1.58, z: 1.12, height: 0.58 },
    ],
  };
}

function createWindowSpecks(towers) {
  const out = [];
  for (const tower of towers) {
    const rows = Math.max(3, Math.floor(tower.height / 0.28));
    const cols = Math.max(1, Math.floor(tower.width / 0.18));
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        if ((row + col + Math.round(tower.x * 10)) % 3 === 0) continue;
        out.push({
          x: tower.x + (col - (cols - 1) / 2) * 0.16,
          y: 0.35 + row * 0.26,
          z: tower.z + tower.depth / 2 + 0.006,
          color: (row + col) % 5 === 0 ? '#fcd34d' : tower.accent,
          width: Math.min(0.08, tower.width * 0.22),
          height: 0.026,
          opacity: (row + col) % 5 === 0 ? 0.28 : 0.2,
        });
      }
    }
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/scene/architectureVisuals.test.mjs`

Expected: PASS.

---

### Task 2: Rebuild And Re-enable The Premium Skyline

**Files:**
- Modify: `src/scene/BackgroundCity.jsx`
- Modify: `src/scene/Scene.jsx`

- [ ] **Step 1: Replace the old skyline renderer**

Use `getPremiumSkylineSpecs()` in `BackgroundCity.jsx`. Render:

- a dark haze plane behind the towers
- tower bodies with stacked setback blocks
- crown variants: `flat`, `terrace`, `lantern`, `needle`, `deco`
- optional spires
- low-opacity window bands from `windowSpecks`

- [ ] **Step 2: Re-enable the component**

Import and render `<BackgroundCity />` near the top of `Scene.jsx`, behind stations.

- [ ] **Step 3: Verify build still compiles**

Run: `npm run build`

Expected: Vite build exits 0.

---

### Task 3: Upgrade Station Dressing And GLB Material Polish

**Files:**
- Modify: `src/scene/Stations.jsx`

- [ ] **Step 1: Replace `StationCityDressing` internals**

Consume `getStationDressingSpecs(station)`. Replace `MiniTower` with refined micro-architecture:

- faceted base
- dark metal body
- subtle facade plane
- station-colored light slot
- warm window strips
- crown-specific roof detail

Keep welcome station dressing empty.

- [ ] **Step 2: Tune GLB material clone treatment**

Inside `GLBBuilding`, adjust cloned materials conservatively:

- lift dark colors slightly toward cool white
- keep `buildingGlow: false` models less emissive
- use metalness/roughness ranges that read as premium glass/metal
- preserve shadows and object cloning

- [ ] **Step 3: Verify station visual tests still pass**

Run: `node --test src/scene/stationVisuals.test.mjs`

Expected: PASS.

---

### Task 4: Integrate Lighting And Browser Visual Verification

**Files:**
- Modify: `src/scene/Environment.jsx`
- Modify: `src/scene/Ground.jsx`

- [ ] **Step 1: Make minimal lighting/floor adjustments**

Only tune fog, horizon glow, or floor opacity if screenshots show the skyline or stations need more separation.

- [ ] **Step 2: Run all project verification**

Run:

```bash
node --test src/scene/architectureVisuals.test.mjs src/scene/stationVisuals.test.mjs src/scene/overviewCamera.test.mjs
npm run build
```

Expected: both commands exit 0.

- [ ] **Step 3: Browser check desktop and mobile**

Open `http://localhost:5173/`.

Check:

- overview canvas is nonblack
- seven station interactions remain visible
- skyline sits behind stations
- welcome monitor is not blocked
- tour mode still focuses a station
- mobile screenshot remains readable

Expected: screenshots show the upgraded architecture and no broken interactions.
