import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useJourney } from '../state/useJourney.js';
import { stations } from '../data/stations.js';
import { depthProfileForStation, resolveStationPalette } from './stationVisuals.js';

// StageSpotlight — a shared overhead visual cue for the overview diorama.
//
// Behaviour (overview mode): whichever station the car is currently at gets a
// visible light shaft + ground glow pool from above. As you drive between
// stations the whole rig slides (and rescales / recolours) to the new station.
// In tour mode it fades out and then stops drawing.
//
// Why a visual-only rig instead of a real spotlight? The previous per-station
// beam toggled its custom additive shader from hidden→visible the instant you
// entered a station, and that first-draw shader compile stalled a frame to
// black. A real spotlight also stays in three.js's forward light loop even when
// faded to intensity 0, which keeps Tour mode paying for an extra per-pixel
// light on top of every station key light. This rig keeps the cinematic beam
// but uses unlit additive meshes only, so Tour mode has no overhead stage light
// cost and no light-count shader churn.

// --- Tunables ---------------------------------------------------------------
const EASE = 5; // slide/fade speed (higher = snappier)
const DRAW_EPSILON = 0.01; // below this, skip the transparent beam draw calls
const DRIVING_DIM = 0.4; // beam level while the car is between stations
const WARMUP_FRAMES = 4; // first-mount frames that force-draw at intensity 0

// FLICKER SAFETY — why this component never causes a black frame:
// 1. Shader prewarm: for the first few frames after mount the beam meshes are
//    force-drawn with uIntensity = 0 (every fragment discards, nothing shows).
//    That makes WebGL compile + link both ShaderMaterials during initial load,
//    behind the loading cover — never later, mid-interaction, where a compile
//    stall used to freeze a frame to black.
// 2. Always mounted, never re-mounted: one shared rig slides between stations.
//    No per-station mount/unmount, no visible-toggle on a never-drawn material.
// 3. No real THREE light: unlit additive meshes only, so the forward-light
//    loop and every other material's shader never recompile because of us.

// Visible volumetric cone — additive, brightest at the silhouette edges and
// the top source, fading toward the bottom so it reads as a glow not a solid.
//
// NaN SAFETY (the black-flash bug): interpolated normals can make
// abs(dot(N, V)) land a hair ABOVE 1.0, so `1.0 - facing` goes slightly
// negative — and on GPUs pow(negative, 1.7) is NaN (exp2(y·log2(x))).
// One NaN alpha additively blended into the HalfFloat HDR buffer gets
// spread across entire mip levels by Bloom's mipmapBlur downsampling —
// i.e. a full-screen black frame. Grazing angles (facing ≈ 1) are most
// common where the overview camera sees the cone most obliquely — the END
// stations — which is exactly where the flicker was reported. Every pow()
// input here MUST stay clamped to [0, 1].
function makeBeamMaterial(color) {
  return {
    uniforms: { uColor: { value: color }, uIntensity: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec3 vN;
      varying vec3 vView;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vView = normalize(-mv.xyz);
        vN = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uIntensity;
      varying vec3 vN;
      varying vec3 vView;
      varying vec2 vUv;
      void main() {
        float facing = clamp(abs(dot(normalize(vN), normalize(vView))), 0.0, 1.0);
        float rim = pow(clamp(1.0 - facing, 0.0, 1.0), 1.7);
        float vert = smoothstep(0.0, 0.22, vUv.y) * mix(0.08, 1.0, vUv.y);
        float a = uIntensity * rim * vert * 0.38;
        gl_FragColor = vec4(uColor, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    // FrontSide (was DoubleSide): the rim glow reads off the outer surface;
    // drawing the inner back faces doubled the fragment cost for a subtle
    // density gain. Also no `discard` — it disables early-Z on tile-based
    // (Apple) GPUs; a zero-alpha additive write costs nothing anyway.
    side: THREE.FrontSide,
    toneMapped: false,
  };
}

// Radial glow pool on the platform under the beam.
function makeDiscMaterial(color) {
  return {
    uniforms: { uColor: { value: color }, uIntensity: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uIntensity;
      varying vec2 vUv;
      void main() {
        float r = length(vUv - 0.5) * 2.0;
        float ring = smoothstep(0.0, 0.35, r) * pow(clamp(1.0 - r, 0.0, 1.0), 1.6);
        float a = uIntensity * ring * 0.32;
        gl_FragColor = vec4(uColor, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    // Faces up; the camera is always above — no need for DoubleSide.
    // No `discard` (see beam material note).
    side: THREE.FrontSide,
    toneMapped: false,
  };
}

export default function StageSpotlight() {
  const groupRef = useRef();
  const beamRef = useRef();

  // Per-station beam colour: the station's theme primary pulled toward white
  // so it reads as a clean stage light rather than a coloured gel.
  const beamColors = useMemo(
    () =>
      stations.map((s) =>
        new THREE.Color(resolveStationPalette(s).primary).lerp(new THREE.Color('#ffffff'), 0.5),
      ),
    [],
  );
  const stationScales = useMemo(
    () => stations.map((_, i) => depthProfileForStation(i).scale ?? 1),
    [],
  );

  const coneMat = useMemo(() => new THREE.ShaderMaterial(makeBeamMaterial(beamColors[0].clone())), [beamColors]);
  const discMat = useMemo(() => new THREE.ShaderMaterial(makeDiscMaterial(beamColors[0].clone())), [beamColors]);

  // Eased state (kept in refs so we never trigger React re-renders per frame).
  const pos = useRef(new THREE.Vector3(...stations[0].position));
  const scale = useRef(stationScales[0]);
  const intensity = useRef(0); // 0 = off (tour), 1 = full (overview, parked)
  const color = useRef(beamColors[0].clone());
  const warmup = useRef(WARMUP_FRAMES); // see FLICKER SAFETY note above

  useFrame((_, dt) => {
    const { currentIndex, viewMode, isDriving, sceneReady } = useJourney.getState();
    const overview = viewMode === 'overview';
    const st = stations[currentIndex] ?? stations[0];
    const k = 1 - Math.exp(-EASE * Math.min(dt, 0.1));

    // Ease position, scale, colour toward the current station.
    pos.current.x += (st.position[0] - pos.current.x) * k;
    pos.current.y += ((st.position[1] ?? 0) - pos.current.y) * k;
    pos.current.z += (st.position[2] - pos.current.z) * k;
    scale.current += ((stationScales[currentIndex] ?? 1) - scale.current) * k;
    color.current.lerp(beamColors[currentIndex] ?? beamColors[0], k);

    // Fade the whole rig in only when in overview (and only once the loading
    // cover is gone, so the first fade-in is actually seen). While driving
    // between stations the beam dims, then blooms to full on arrival — that's
    // the "spotlight lands on the station" beat.
    const target = overview && sceneReady ? (isDriving ? DRIVING_DIM : 1) : 0;
    intensity.current += (target - intensity.current) * k;
    const vis = intensity.current;

    const grp = groupRef.current;
    if (grp) {
      grp.position.copy(pos.current);
      grp.scale.setScalar(scale.current);
    }

    coneMat.uniforms.uIntensity.value = vis;
    coneMat.uniforms.uColor.value.copy(color.current);
    discMat.uniforms.uIntensity.value = vis;
    discMat.uniforms.uColor.value.copy(color.current);

    if (beamRef.current) {
      // Prewarm window: force the (invisible, all-fragments-discard) draw so
      // the shaders compile during load. Afterwards, skip the transparent
      // draw calls entirely whenever the rig is effectively off.
      if (warmup.current > 0) {
        warmup.current -= 1;
        beamRef.current.visible = true;
      } else {
        beamRef.current.visible = vis > DRAW_EPSILON;
      }
    }
  });

  return (
    <group ref={groupRef}>
      <group ref={beamRef}>
        {/* Visible light shaft — narrow at the top (source), flaring onto the building. */}
        <mesh position={[0, 4.9, 0]} raycast={() => null}>
          <cylinderGeometry args={[0.12, 1.25, 7.6, 18, 1, true]} />
          <primitive object={coneMat} attach="material" />
        </mesh>
        {/* Ground glow pool where the beam lands. */}
        <mesh position={[0, 0.2, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
          <circleGeometry args={[1.65, 24]} />
          <primitive object={discMat} attach="material" />
        </mesh>
      </group>
    </group>
  );
}
