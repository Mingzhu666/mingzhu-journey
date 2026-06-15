# Poster Diorama Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recompose and restyle the 3D portfolio overview so it strongly resembles the supplied neon low-poly seven-station city poster.

**Architecture:** Keep the existing React Three Fiber scene architecture. Add one small pure visual metadata module for label/sign formatting, then update the existing scene components that already own lighting, post-processing, station rendering, and camera composition.

**Tech Stack:** React 18, Vite, React Three Fiber, drei, Three.js, @react-three/postprocessing, Node built-in test runner.

---

### Task 1: Station Poster Metadata

**Files:**
- Create: `src/scene/stationVisuals.js`
- Create: `src/scene/stationVisuals.test.mjs`
- Modify: `src/scene/Stations.jsx`

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { posterLabelForStation, resolveStationPalette } from './stationVisuals.js';

test('posterLabelForStation formats station labels like the reference poster', () => {
  const label = posterLabelForStation({
    index: 4,
    title: 'Projects',
    subtitle: 'Featured Work',
  });

  assert.deepEqual(label, {
    number: '04',
    title: 'PROJECTS',
    subtitle: 'Featured Work',
  });
});

test('resolveStationPalette returns accent colors with fallbacks', () => {
  const palette = resolveStationPalette({
    color: '#6ee7ff',
    accent: '#22d3ee',
  });

  assert.equal(palette.primary, '#6ee7ff');
  assert.equal(palette.accent, '#22d3ee');
  assert.equal(palette.panel, '#071b2d');
  assert.equal(palette.structure, '#17223a');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/scene/stationVisuals.test.mjs`

Expected: FAIL because `src/scene/stationVisuals.js` does not exist.

- [ ] **Step 3: Implement the helper**

Create `src/scene/stationVisuals.js` with `posterLabelForStation` and `resolveStationPalette`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/scene/stationVisuals.test.mjs`

Expected: PASS.

### Task 2: Poster Station Rendering

**Files:**
- Modify: `src/scene/Stations.jsx`
- Modify: `src/data/stations.js`

- [ ] **Step 1: Import the visual helper**

Use `posterLabelForStation` and `resolveStationPalette` inside `Stations.jsx`.

- [ ] **Step 2: Replace the current circular platform look**

Upgrade `Platform` into a stacked floating city-island base with dark extruded cylinders, brighter edge rings, station-colored underglow, and stronger local lighting.

- [ ] **Step 3: Add top poster labels**

Update `FloatingNumber` to render number, title, subtitle, vertical beam, and dot in the reference style.

- [ ] **Step 4: Add station signage and filler geometry**

Add small procedural components inside `Stations.jsx`: a glowing signboard in front of each building plus deterministic low-poly towers/trees near each platform to increase city density.

- [ ] **Step 5: Enhance GLB readability**

In `GLBBuilding`, clone materials and gently brighten color/roughness/emissive values, using station color for low-intensity glow without turning the whole model into neon.

### Task 3: Environment, Camera, Ground, And Bloom

**Files:**
- Modify: `src/scene/Environment.jsx`
- Modify: `src/scene/Ground.jsx`
- Modify: `src/scene/PostFX.jsx`
- Modify: `src/scene/CameraRig.jsx`
- Modify: `src/App.jsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Deepen the environment**

Use a blue-black background and distant fog so dark areas stay dark instead of grey.

- [ ] **Step 2: Make the ground less flat and grey**

Darken the ground, reduce grid dominance, and add a subtle horizon glow instead of a grey plane.

- [ ] **Step 3: Tighten the overview camera**

Reduce empty sky and put building mid-heights in the primary frame.

- [ ] **Step 4: Adjust post-processing**

Increase bloom intensity for emissive accents while keeping threshold high enough that the whole scene does not haze over.

- [ ] **Step 5: Tune UI overlay darkness**

Make overlay glass panels closer to the reference and reduce visual competition with buildings.

### Task 4: Verification And Visual Tuning

**Files:**
- Verify all changed files.

- [ ] **Step 1: Run helper tests**

Run: `node --test src/scene/stationVisuals.test.mjs`

Expected: PASS.

- [ ] **Step 2: Run production build**

Run: `npm run build`

Expected: build exits 0.

- [ ] **Step 3: Browser visual check**

Open `http://localhost:5180/`, wait for model loading, and capture an overview screenshot.

Expected: the canvas is nonblank, the seven-station row is visible, buildings are clearer, the scene is darker and cleaner, and station labels/platforms resemble the supplied reference.

- [ ] **Step 4: Tune once if needed**

If the screenshot still reads grey, lower ambient/fog/grid. If buildings are too dim, increase local lights and GLB material lift. If bloom is muddy, raise threshold or reduce intensity.
