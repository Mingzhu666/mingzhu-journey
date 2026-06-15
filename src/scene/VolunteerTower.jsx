import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { Text } from './SafeText.jsx';
import * as THREE from 'three';
import { resolveVisualBalance } from './stationVisuals.js';
import { useJourney } from '../state/useJourney.js';

// VolunteerTower (station 6) — the uploaded Blender GLB neon tower.
//
// IMPORTANT: the neon is NOT baked into the GLB. The .glb ships only
// geometry + static materials; the glow is rebuilt here in code.
//
// STEADY NEON (user request): the tower used to run a flowing multi-colour
// gradient (magenta→violet→blue→cyan), a breathing pulse, a rising bright
// band, and an arrival-gated dim/bright ramp. All of that is gone — the
// whole tower's neon is now ONE solid colour, constantly lit (常亮), in
// overview and tour alike. No gradient, no pulse, no gating.
//
// Materials are swapped BY NAME on the loaded model (check order matters —
// Beacon / Neon_Sign before Neon, because "Neon_Sign".startsWith("Neon")):
//   Neon / Neon_Sign -> steady solid-colour neon shader
//   Beacon           -> spire beacon (steady on)
//   everything else (TowerBody / TowerTrim / Seam / SignPanel) keeps its
//   GLB standard material so the scene lights illuminate it normally.
//
// The glow itself comes from Bloom in PostFX.jsx (ENABLE_POSTFX must be
// true) — these shaders push intensity above 1.0 so the bloom pass turns
// the bright pixels into halos.

const MODEL = '/models/volunteer_tower.glb';

// The tower's signature neon colour (matches the VOLUNTEER lettering).
const NEON_COLOR = '#ff2db0';

// LIGHT BUDGET (user request: "把多数灯关掉，让 VOLUNTEER 明显"): the
// lettering is the hero — everything else is dimmed to near-off so it can't
// compete. Final emitted intensity ≈ value × emissiveScale (0.34 here);
// only values landing >1 get a Bloom halo.
const STRUCTURAL_INTENSITY = 0.8; // rails/corners/base strips: faint, no bloom
const SIGN_RAIL_INTENSITY = 2.6; // sign-panel frame: subtle, just frames the word
const BEACON_INTENSITY = 1.0; // spire beacon: barely-there marker

// ARRIVAL DIM (车未到时调暗、车到了保持现有亮度): mirror the final Connect
// station's arrival-gated glow. The tower holds its CURRENT brightness while
// the car is parked at this station (倒数第二站), and eases DOWN to AWAY_DIM ×
// that brightness whenever the car is anywhere else. So "目前的亮度" becomes the
// car-present brightness, and the building is "稍微暗一点" when the car is away.
// 1 = no dimming; lower = darker when away. Tune this one number to taste.
const AWAY_DIM = 0.5;

const NEON_VERT = /* glsl */ `
  void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

// Steady solid colour, no time-based terms at all. uSteadyIntensity ×
// uIntensityScale lands ≈2 in HDR — bright enough for a clean bloom halo,
// constant forever.
const NEON_FRAG = /* glsl */ `
  precision highp float;
  uniform vec3 uNeonColor;
  uniform float uSteadyIntensity, uIntensityScale, uArrival;
  void main(){
    // uArrival is eased per-frame in JS: 1 when the car is parked here,
    // AWAY_DIM when it's away (车未到时调暗).
    gl_FragColor = vec4(uNeonColor * uSteadyIntensity * uIntensityScale * uArrival, 1.0);
  }
`;

const BEACON_FRAG = /* glsl */ `
  uniform float uSteadyIntensity, uIntensityScale, uArrival;
  void main(){
    // Steady-on (no blink) but rides the arrival dim like the rest of the tower.
    gl_FragColor = vec4(vec3(1.0, 0.12, 0.30) * uSteadyIntensity * uIntensityScale * uArrival, 1.0);
  }
`;

// The GLB ships only a blank sign panel + glowing rails — the actual word
// is missing from the export. We draw it vertically (tower-sign style) down
// the panel face. The panel sits at local (0, 9.0, +1.5), ~1.55 wide x 5 tall.
const SIGN_TEXT = 'V\nO\nL\nU\nN\nT\nE\nE\nR';

// Steady HDR lettering colour (hot pink pushed >1 so Bloom haloes it while
// the bright core keeps glyphs legible). Passed as troika's per-instance
// `color` prop — troika copies it into its derived material every render.
//
// WARNING — do NOT mutate `text.material.color` instead: with outline props
// set, troika's `material` getter returns an ARRAY [outline, main], so
// `material.color` is undefined and a per-frame `.setRGB` on it throws every
// frame, killing the whole R3F render loop (the "all buildings disappeared"
// bug). Module-level constant so the prop identity is stable across renders.
const SIGN_COLOR_HDR = new THREE.Color(3.2, 1.5, 2.4);

export default function VolunteerTower({ station }) {
  const { scene } = useGLTF(MODEL);
  const modelRef = useRef();
  const signTextRef = useRef();
  const balance = resolveVisualBalance(station);

  // Eased dim amount (0 = car away ⇒ AWAY_DIM brightness, 1 = parked here ⇒
  // current brightness) and the shader materials whose uArrival uniform it
  // drives. Populated in the useMemo below.
  const arrival = useRef(0);
  const arrivalMatsRef = useRef([]);
  // This tower is station 6; useJourney.currentIndex is 0-based, so subtract 1.
  const myIndex = station.index - 1;

  const cloned = useMemo(() => {
    // Steady solid-colour neon at two levels: near-off for the structure,
    // subtle for the sign-panel frame (see LIGHT BUDGET above).
    const makeNeon = (steadyIntensity) =>
      new THREE.ShaderMaterial({
        uniforms: {
          uNeonColor: { value: new THREE.Color(NEON_COLOR) },
          uSteadyIntensity: { value: steadyIntensity },
          uIntensityScale: { value: balance.emissiveScale },
          // Start dim (car begins at the welcome station, away from here).
          uArrival: { value: AWAY_DIM },
        },
        vertexShader: NEON_VERT,
        fragmentShader: NEON_FRAG,
        toneMapped: false,
      });
    const neon = makeNeon(STRUCTURAL_INTENSITY);
    const signRails = makeNeon(SIGN_RAIL_INTENSITY);
    const beacon = new THREE.ShaderMaterial({
      uniforms: {
        uSteadyIntensity: { value: BEACON_INTENSITY },
        uIntensityScale: { value: balance.emissiveScale },
        uArrival: { value: AWAY_DIM },
      },
      vertexShader: NEON_VERT,
      fragmentShader: BEACON_FRAG,
      toneMapped: false,
    });

    // Hand these to the per-frame loop so it can ride uArrival up/down.
    arrivalMatsRef.current = [neon, signRails, beacon];

    const c = scene.clone(true);
    c.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
      const mn = o.material && o.material.name ? o.material.name : '';
      // ORDER MATTERS: Beacon / Neon_Sign before Neon.
      if (mn.startsWith('Beacon')) o.material = beacon;
      else if (mn.startsWith('Neon_Sign')) o.material = signRails;
      else if (mn.startsWith('Neon')) o.material = neon;
      else if (o.material) {
        // TowerBody / TowerTrim / Seam / SignPanel keep the GLB's lit
        // material, but get the SAME colour lift the matte GLB stations
        // receive (0.85 × materialLift, see resolveGlowPolicy). Without
        // this the tower's near-black body measured darkest in the row
        // (33 vs the 52 band) under the unified global moonlight.
        const lift = (material) => {
          if (!material) return material;
          const next = material.clone();
          if (next.color) {
            next.color.multiplyScalar(0.85 * balance.materialLift);
            // The body albedo is near-BLACK, so a multiplier alone barely
            // moves it (measured 33 → 37). Lerp adds a floor the moonlight
            // can actually light — same trick as liftMaterial in
            // Stations.jsx, just a stronger blend for this darker model.
            next.color.lerp(new THREE.Color('#7d94bd'), 0.1);
          }
          return next;
        };
        o.material = Array.isArray(o.material) ? o.material.map(lift) : lift(o.material);
      }
    });

    return c;
  }, [scene, balance.emissiveScale, balance.materialLift]);

  // Per-frame: (1) ease the arrival dim factor from the car's position, then
  // (2) push it into the neon shaders and the VOLUNTEER lettering. The car
  // "arrives" exactly like the final station — parked here (this is the
  // current station) and not driving. Eased with the same -6 time constant
  // the StationItem arrival glow uses, so it brightens/dims smoothly.
  useFrame((_, dt) => {
    const { currentIndex, isDriving, sceneReady } = useJourney.getState();
    const arrived = sceneReady && currentIndex === myIndex && !isDriving;
    const k = 1 - Math.exp(-6 * Math.min(dt || 0.016, 0.1));
    arrival.current += ((arrived ? 1 : 0) - arrival.current) * k;
    const factor = AWAY_DIM + (1 - AWAY_DIM) * arrival.current;

    // Structure neon, sign-panel frame, and beacon.
    for (const m of arrivalMatsRef.current) {
      if (m && m.uniforms && m.uniforms.uArrival) m.uniforms.uArrival.value = factor;
    }

    // VOLUNTEER lettering. Keep it out of tone mapping (so the HDR colour
    // reaches Bloom intact) AND ride the same dim factor. We cache each
    // material's authored colour once, then scale it by `factor` — multiplying
    // an existing THREE.Color is safe, unlike the `.setRGB` on the array's
    // undefined `.color` that previously killed the render loop (see the
    // SIGN_COLOR_HDR warning above). Array-safe: with outline props troika's
    // `material` getter returns [outline, main]; both get the same scale and
    // the dark outline is unaffected to the eye.
    const txt = signTextRef.current;
    if (!txt || !txt.material) return;
    const mats = Array.isArray(txt.material) ? txt.material : [txt.material];
    for (const m of mats) {
      if (!m) continue;
      if (m.toneMapped !== false) m.toneMapped = false;
      if (m.color) {
        if (!m.userData.baseColor) m.userData.baseColor = m.color.clone();
        m.color.copy(m.userData.baseColor).multiplyScalar(factor);
      }
    }
  });

  // Same seating convention as GLBBuilding: lift onto the platform, then
  // apply the per-station offset / rotation / scale from stations.js.
  const baseLift = 0.06;
  const offset = station.modelOffset ?? [0, 0, 0];
  const position = [offset[0], baseLift + offset[1], offset[2]];
  const rotation = station.modelRotation ?? [0, 0, 0];
  const scale = station.modelScale ?? 1;
  const tiltY = station.tiltY ?? 0;

  return (
    <group rotation={[0, tiltY, 0]}>
      {/* Model + lettering share one transform group so the text sits in the
          GLB's own coordinate space, glued to the sign panel. */}
      <group position={position} rotation={rotation} scale={scale}>
        <primitive ref={modelRef} object={cloned} />

        {/* VOLUNTEER lettering — drawn in code because it isn't in the GLB.
            Placed just in front of the +Z sign panel (panel face ~z=1.56).
            Legibility: 9 letters × 0.62 × 0.88 ≈ 4.91 local ≈ panel height.
            GEOMETRY RULE — keep fontSize × lineHeight comfortably above
            fontSize × ~0.72 (the font's cap height): at 0.78/0.70 the
            stacked capitals physically overlapped and their dark outlines
            cut notches into each other ("字好奇怪"). 0.62/0.88 leaves a
            clear gap between letters. Thin dark outline keeps bloom from
            smearing the letterforms; 128px SDF for crisp edges. */}
        <Text
          ref={signTextRef}
          position={[0, 9.0, 1.62]}
          fontSize={0.62}
          lineHeight={0.88}
          anchorX="center"
          anchorY="middle"
          color={SIGN_COLOR_HDR}
          outlineWidth={0.018}
          outlineColor="#1a0612"
          sdfGlyphSize={128}
        >
          {SIGN_TEXT}
        </Text>
      </group>
    </group>
  );
}

useGLTF.preload(MODEL);
