import test from 'node:test';
import assert from 'node:assert/strict';
import {
  depthProfileForStation,
  posterLabelForStation,
  resolveGlowPolicy,
  resolvePlatformArrivalVisuals,
  resolveStationPalette,
  resolveTrackVisuals,
  resolveVisualBalance,
  shouldActivateArrivalEffects,
  shouldShowWelcomeContent,
} from './stationVisuals.js';
import * as stationVisuals from './stationVisuals.js';
import { stations } from '../data/stations.js';

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

test('resolveGlowPolicy keeps imported buildings dark while UI light sources can glow', () => {
  const policy = resolveGlowPolicy({
    buildingGlow: false,
  });

  assert.deepEqual(policy, {
    buildingMaterialEmissive: 0,
    buildingColorLift: 0.85,
    modelBackdropOpacity: 0,
    platformUnderglowOpacity: 0.018,
    windowOpacity: 0.86,
    signEmissiveIntensity: 0.18,
    beamOpacity: 0.68,
  });
});

test('resolveVisualBalance defaults to neutral rendering multipliers', () => {
  assert.deepEqual(resolveVisualBalance({}), {
    materialLift: 1,
    platformGlow: 1,
    windowGlow: 1,
    labelGlow: 1,
    emissiveScale: 1,
    backdropOpacity: 0,
  });
});

// Unified-brightness pass: every station shares the same accent treatment
// (windows, platform glow) under the single global moonlight. materialLift
// intentionally varies per station — each GLB's textures have different
// albedo, so the lifts are calibrated against measured screen luminance to
// land every building in the SAME visible brightness band (see the
// MATTE_BUILDING_BALANCE comment in src/data/stations.js).
test('all matte stations share the same window/accent treatment', () => {
  // preserveModelMaterials stations (contact) keep authored materials, so
  // materialLift never applies to them — they're normalized via
  // emissiveScale instead (covered by the neon-heavy test below).
  const matte = stations.filter((s) => s.buildingGlow === false && !s.preserveModelMaterials);
  assert.ok(matte.length >= 5);

  const reference = resolveVisualBalance(matte[0]);
  for (const station of matte.slice(1)) {
    const balance = resolveVisualBalance(station);
    assert.equal(balance.windowGlow, reference.windowGlow, `${station.id} windowGlow`);
    assert.ok(balance.materialLift > 1, `${station.id} should still lift its matte materials`);
  }
});

test('every station lands in the same platform-glow brightness band', () => {
  const underglows = stations.map((s) => resolveGlowPolicy(s).platformUnderglowOpacity);
  const min = Math.min(...underglows);
  const max = Math.max(...underglows);
  assert.ok(max - min < 0.004, `platform underglow spread too wide: ${min} .. ${max}`);

  const beams = stations.map((s) => resolveGlowPolicy(s).beamOpacity);
  const beamMin = Math.min(...beams);
  const beamMax = Math.max(...beams);
  assert.ok(beamMax - beamMin < 0.03, `label beam spread too wide: ${beamMin} .. ${beamMax}`);
});

test('neon-heavy stations still normalize their authored emissive into the row band', () => {
  // The Volunteering station ('achievements') used to be a self-lit neon tower;
  // it's now a normal matte GLB building, so only the Connect hub ('contact')
  // still carries hot authored neon that needs normalizing.
  const neonHeavy = stations.filter((s) => s.id === 'contact');
  assert.equal(neonHeavy.length, 1);
  for (const station of neonHeavy) {
    assert.ok(
      resolveVisualBalance(station).emissiveScale < 1,
      `${station.id} should restrain hot authored neon toward the shared brightness band`,
    );
  }
});

test('generic GLB station buildings do not render circular backdrop halos', () => {
  const customStationComponents = new Set([
    'holoPortfolio',
    'volunteerTimeline',
    'volunteerTower',
    'contactConsole',
  ]);
  const genericGlbStations = stations.filter(
    (station) =>
      station.model &&
      station.id !== 'welcome' &&
      !customStationComponents.has(station.component),
  );

  assert.ok(genericGlbStations.length > 0);
  for (const station of genericGlbStations) {
    assert.equal(
      resolveGlowPolicy(station).modelBackdropOpacity,
      0,
      `${station.index} ${station.title} should not have a circular backdrop glow`,
    );
  }
});

test('arrival effects only activate after the car is parked at the station', () => {
  const volunteering = stations.find((station) => station.id === 'achievements');
  const welcome = stations.find((station) => station.id === 'welcome');

  assert.equal(
    shouldActivateArrivalEffects({
      station: welcome,
      currentIndex: 1,
      isDriving: false,
    }),
    false,
    'welcome content is inactive while the car is parked elsewhere',
  );
  assert.equal(
    shouldActivateArrivalEffects({
      station: welcome,
      currentIndex: welcome.index - 1,
      isDriving: false,
    }),
    true,
    'welcome content is active once the car is parked at welcome',
  );

  assert.equal(
    shouldActivateArrivalEffects({
      station: volunteering,
      currentIndex: 0,
      isDriving: false,
    }),
    false,
    'inactive before the route reaches the station',
  );
  assert.equal(
    shouldActivateArrivalEffects({
      station: volunteering,
      currentIndex: volunteering.index - 1,
      isDriving: true,
    }),
    false,
    'inactive while the car is still driving to the station',
  );
  assert.equal(
    shouldActivateArrivalEffects({
      station: volunteering,
      currentIndex: volunteering.index - 1,
      isDriving: false,
    }),
    true,
    'active only once the car is parked at the station',
  );
});

test('welcome monitor content is always displayed once the scene is ready', () => {
  const welcome = stations.find((station) => station.id === 'welcome');
  const education = stations.find((station) => station.id === 'about');

  assert.equal(
    shouldShowWelcomeContent({
      station: welcome,
      sceneReady: false,
    }),
    false,
    'first-load welcome content should wait until the loading cover is gone',
  );
  assert.equal(
    shouldShowWelcomeContent({
      station: welcome,
      sceneReady: true,
    }),
    true,
    'welcome content shows once the scene is ready',
  );
  assert.equal(
    shouldShowWelcomeContent({
      station: welcome,
      currentIndex: 3,
      isDriving: true,
      sceneReady: true,
    }),
    true,
    'welcome content stays on even while the car is parked elsewhere or driving',
  );
  assert.equal(
    shouldShowWelcomeContent({
      station: education,
      sceneReady: true,
    }),
    false,
    'only the welcome station shows the monitor content',
  );
});

test('every station ground halo lights up on arrival and fades when the car leaves', () => {
  assert.ok(stations.length > 0);

  for (const station of stations) {
    const inactive = resolvePlatformArrivalVisuals(station, {
      arrivalActive: shouldActivateArrivalEffects({
        station,
        currentIndex: station.index === 1 ? 1 : 0, // car parked elsewhere
        isDriving: false,
      }),
    });
    const active = resolvePlatformArrivalVisuals(station, {
      arrivalActive: shouldActivateArrivalEffects({
        station,
        currentIndex: station.index - 1,
        isDriving: false,
      }),
    });
    const driving = resolvePlatformArrivalVisuals(station, {
      arrivalActive: shouldActivateArrivalEffects({
        station,
        currentIndex: station.index - 1,
        isDriving: true,
      }),
    });

    assert.equal(inactive.enabled, true, `${station.title} should use arrival-gated ground halo`);
    // The inner ring at the building's feet vanishes entirely when the car
    // is away; the outer ground ring keeps a faint dark trace.
    assert.equal(inactive.innerRingOpacity, 0, `${station.title} inner ring should vanish while the car is elsewhere`);
    assert.ok(active.innerRingOpacity > 0.78, `${station.title} inner ring should light up after arrival`);
    assert.ok(inactive.outerRingOpacity > 0, `${station.title} outer ring should keep a faint trace when the car is away`);
    assert.ok(inactive.outerRingOpacity < 0.24, `${station.title} ground halo should be dark while the car is elsewhere`);
    assert.ok(active.outerRingOpacity > 0.5, `${station.title} ground halo should brighten after arrival`);
    assert.ok(inactive.underglowOpacity < 0.02, `${station.title} underglow should be dark while the car is elsewhere`);
    assert.ok(
      active.underglowOpacity > inactive.underglowOpacity * 5,
      `${station.title} underglow should brighten after arrival`,
    );
    assert.ok(active.pulseOpacity > inactive.pulseOpacity, `${station.title} should gain a pulse on arrival`);
    assert.equal(
      driving.outerRingOpacity,
      inactive.outerRingOpacity,
      `${station.title} ground halo should stay dark while the car is still driving`,
    );
  }

  // Partial reveal interpolates between off and on for the eased animation.
  const welcome = stations.find((station) => station.id === 'welcome');
  const mid = resolvePlatformArrivalVisuals(welcome, { reveal: 0.5 });
  const off = resolvePlatformArrivalVisuals(welcome, { reveal: 0 });
  const on = resolvePlatformArrivalVisuals(welcome, { reveal: 1 });
  assert.ok(mid.outerRingOpacity > off.outerRingOpacity);
  assert.ok(mid.outerRingOpacity < on.outerRingOpacity);
});

test('depthProfileForStation alternates stations between foreground and background', () => {
  assert.deepEqual(
    Array.from({ length: 7 }, (_, index) => depthProfileForStation(index)),
    [
      { zOffset: 1.70, scale: 1.14, layer: 'front' },
      { zOffset: -1.05, scale: 0.88, layer: 'back' },
      { zOffset: 1.25, scale: 1.10, layer: 'front' },
      { zOffset: -1.65, scale: 0.85, layer: 'back' },
      { zOffset: 1.45, scale: 1.12, layer: 'front' },
      { zOffset: -1.15, scale: 0.88, layer: 'back' },
      { zOffset: 1.55, scale: 1.13, layer: 'front' },
    ],
  );
});

test('resolveTrackVisuals describes a dark road with subtle lane and edge lights', () => {
  assert.deepEqual(resolveTrackVisuals(), {
    roadWidth: 0.96,
    roadSegmentEvery: 12,
    laneDashEvery: 18,
    edgeOffset: 0.54,
    edgeLightOpacity: 0.42,
    laneLightOpacity: 0.38,
    nodeEvery: 72,
  });
});

test('station visuals no longer exports lower plaque helpers', () => {
  assert.equal('resolvePlaqueVisuals' in stationVisuals, false);
  assert.equal('resolvePlaquePlacement' in stationVisuals, false);
});
