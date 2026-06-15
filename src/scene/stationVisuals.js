export function posterLabelForStation(station) {
  return {
    number: String(station.index).padStart(2, '0'),
    title: station.title.toUpperCase(),
    subtitle: station.subtitle,
  };
}

export function resolveStationPalette(station) {
  return {
    primary: station.color ?? '#6ee7ff',
    accent: station.accent ?? station.color ?? '#22d3ee',
    panel: station.panelColor ?? '#071b2d',
    structure: station.structureColor ?? '#17223a',
  };
}

function positiveNumber(value, fallback) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function mixNumber(a, b, t) {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

export function resolveVisualBalance(station) {
  const balance = station.visualBalance ?? {};

  return {
    materialLift: positiveNumber(balance.materialLift, 1),
    // (keyLight knob removed — per-station key lights no longer exist after
    // the unified-lighting pass.)
    platformGlow: positiveNumber(balance.platformGlow, 1),
    windowGlow: positiveNumber(balance.windowGlow, 1),
    labelGlow: positiveNumber(balance.labelGlow, 1),
    emissiveScale: positiveNumber(balance.emissiveScale, 1),
    backdropOpacity: positiveNumber(balance.backdropOpacity, 0),
  };
}

export function shouldActivateArrivalEffects({ station, currentIndex, isDriving }) {
  if (!station) return false;
  return currentIndex === station.index - 1 && !isDriving;
}

// The welcome monitor's screen content is ALWAYS displayed once the loading
// cover is gone — it no longer waits for the car to park at the station.
// (Interactivity — the zoomed command panel — is still arrival-gated in
// WelcomeMonitor.jsx via shouldActivateArrivalEffects.)
export function shouldShowWelcomeContent({ station, sceneReady = true }) {
  return sceneReady && station?.id === 'welcome';
}

// Arrival-gated ring visuals — applies to EVERY station. The rings (inner
// ring at the building's feet, outer ground ring, underglow disc, pulse)
// animate up when the car parks at the station and fade back out when it
// leaves: the inner ring disappears entirely, the outer ground ring keeps a
// faint dark trace. Per-station overrides come from the optional
// `platformArrival` block in src/data/stations.js; sensible defaults apply
// otherwise. Steady-on platform accents (strips) are handled directly in
// Stations.jsx.
export function resolvePlatformArrivalVisuals(station, { arrivalActive = false, reveal } = {}) {
  const cfg = station?.platformArrival ?? {};

  const r = Number.isFinite(reveal)
    ? Math.max(0, Math.min(1, reveal))
    : arrivalActive
      ? 1
      : 0;

  return {
    enabled: true,
    reveal: r,
    // The inner ring sits right at the building's feet — it vanishes
    // COMPLETELY (off = 0) when the car leaves, while the outer ground
    // ring keeps a faint dark trace so the route still reads in overview.
    innerRingOpacity: mixNumber(
      0,
      positiveNumber(cfg.innerRingOn, 0.92),
      r,
    ),
    outerRingOpacity: mixNumber(
      positiveNumber(cfg.outerRingOff, 0.07),
      positiveNumber(cfg.outerRingOn, 0.62),
      r,
    ),
    underglowOpacity: mixNumber(
      positiveNumber(cfg.underglowOff, 0.006),
      positiveNumber(cfg.underglowOn, 0.12),
      r,
    ),
    pulseOpacity: mixNumber(
      0,
      positiveNumber(cfg.pulseOn, 0.3),
      r,
    ),
  };
}

export function resolveGlowPolicy(station) {
  const buildingGlow = station.buildingGlow !== false;
  const balance = resolveVisualBalance(station);

  return {
    buildingMaterialEmissive: (buildingGlow ? 0.035 : 0) * balance.emissiveScale,
    // Matte (non-glow) GLB buildings were pre-darkened to 0.72, which left
    // them reading much dimmer than the self-lit neon stations (Volunteering
    // tower, Connect hub) in the wide overview. Lifted to 0.85 so the matte
    // buildings sit closer to the same brightness band — more unified row.
    buildingColorLift: (buildingGlow ? 0.66 : 0.85) * balance.materialLift,
    modelBackdropOpacity: buildingGlow
      ? 0.055 * balance.platformGlow
      : balance.backdropOpacity,
    platformUnderglowOpacity: (buildingGlow ? 0.072 : 0.018) * balance.platformGlow,
    windowOpacity: Math.min(1, (buildingGlow ? 0.94 : 0.86) * balance.windowGlow),
    signEmissiveIntensity: (buildingGlow ? 0.26 : 0.18) * balance.emissiveScale,
    beamOpacity: Math.min(1, (buildingGlow ? 0.78 : 0.68) * balance.labelGlow),
  };
}

// Per-station Z offset + uniform scale. Offsets are ~2× larger than the
// initial pass to create a more obvious "diorama with depth" feel —
// front-row stations sit visibly closer to the camera, back-row ones
// recede behind. The scale field is applied to the whole station group
// in Stations.jsx, so closer stations also render bigger, which doubles
// the depth perception (parallax + foreshortening together).
const DEPTH_PROFILES = [
  { zOffset: 1.70, scale: 1.14, layer: 'front' },
  { zOffset: -1.05, scale: 0.88, layer: 'back' },
  { zOffset: 1.25, scale: 1.10, layer: 'front' },
  { zOffset: -1.65, scale: 0.85, layer: 'back' },
  { zOffset: 1.45, scale: 1.12, layer: 'front' },
  { zOffset: -1.15, scale: 0.88, layer: 'back' },
  { zOffset: 1.55, scale: 1.13, layer: 'front' },
];

export function depthProfileForStation(index) {
  return DEPTH_PROFILES[index] ?? { zOffset: 0, scale: 1, layer: 'middle' };
}

export function resolveTrackVisuals() {
  return {
    roadWidth: 0.96,
    roadSegmentEvery: 12,
    laneDashEvery: 18,
    edgeOffset: 0.54,
    edgeLightOpacity: 0.42,
    laneLightOpacity: 0.38,
    nodeEvery: 72,
  };
}
