import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { Text } from './SafeText.jsx';
import * as THREE from 'three';
import { stations } from '../data/stations.js';
import { useJourney } from '../state/useJourney.js';
import WelcomeMonitor from './WelcomeMonitor.jsx';
import HoloPortfolio from './HoloPortfolio.jsx';
import VolunteerTimeline from './VolunteerTimeline.jsx';
import ContactConsole from './ContactConsole.jsx';
import FaceSign from './FaceSign.jsx';
import ConnectFaceSign from './ConnectFaceSign.jsx';
import { getStationDressingSpecs } from './architectureVisuals.js';
import {
  depthProfileForStation,
  posterLabelForStation,
  resolveGlowPolicy,
  resolvePlatformArrivalVisuals,
  resolveStationPalette,
  resolveVisualBalance,
  shouldActivateArrivalEffects,
} from './stationVisuals.js';

// Each station is a small low-poly "diorama building" plus a glowing
// platform and a floating index number. Geometry is intentionally simple
// — every station can be replaced with a Blender .glb later by adding a
// `model` URL in src/data/stations.js and swapping the renderer here for
// useGLTF + primitive.
//
// The platform is shared across all stations (same shape, station-themed
// emissive color); the building is themed per id so each section has its
// own visual identity.

export default function Stations() {
  return (
    <group>
      {stations.map((station, i) => (
        <StationItem key={station.id} station={station} index={i} />
      ))}
    </group>
  );
}

/* -------------------- Per-station item -------------------- */
// Wraps one station's visuals and layers on the TOUR-mode "spotlight"
// behaviour:
//   • In tour mode, the ACTIVE station's OWN key light is boosted so the
//     building is clearly lit and reads as the focus.
//   • Every OTHER station dims down (light + materials fade to faint
//     ghosts) and slides away so the active building owns the stage.
//   • In overview mode nothing is dimmed — identical to the original look.
// All transitions are eased per-frame so switching never pops.
//
// NOTE: We deliberately do NOT add any new lights here, and an earlier
// overhead light-beam mesh was removed — its custom additive shader compiled
// on first show when entering tour and could stall a frame to black. Each
// platform ships a single warm key light; we only scale what's already there.

// How dark non-active buildings get in tour mode (0 = invisible, 1 = full).
// Lower this toward 0 to make neighbours disappear entirely.
const NEIGHBOR_DIM = 0.12;
// Extra brightness applied to the active building's own key light when it's
// fully focused in tour (0 = no boost, 1 = double brightness).
const FOCUS_BOOST = 0.45;

// Tour-mode "presentation": non-active stations slide away from the active
// one (and shrink) so the active building gets a clear stage to itself.
const AWAY_DIST = 5.0; // how far neighbours push outward, in world units
const AWAY_DROP = 1.6; // how far they sink as they leave
const AWAY_SCALE = 0.55; // how small they shrink (1 = no shrink)

function StationItem({ station, index }) {
  const goTo = useJourney((s) => s.goTo);
  const currentIndex = useJourney((s) => s.currentIndex);
  const hoveredStationId = useJourney((s) => s.hoveredStationId);
  const setHoveredStation = useJourney((s) => s.setHoveredStation);
  const viewMode = useJourney((s) => s.viewMode);
  const isDriving = useJourney((s) => s.isDriving);
  const sceneReady = useJourney((s) => s.sceneReady);

  const contentRef = useRef();
  const presence = useRef(1); // 1 = full, NEIGHBOR_DIM = dimmed
  // Eased 0→1 "focus" amount for the active station in tour. It used to also
  // drive an overhead light-beam mesh, but that mesh's custom additive shader
  // compiled on first show when entering tour and could stall a frame to black,
  // so the beam was removed. This value now only boosts the active building's
  // own key light (see FOCUS_BOOST).
  const beam = useRef(0);
  const away = useRef(0); // 0 = in place, 1 = fully slid away (tour, non-active)
  const dimmables = useRef(null);
  // Eased 0→1 "arrival glow" for the optional `arrivalTextBoost` (e.g. the
  // Connect hub's neon text brightens when the car parks, then eases back to
  // its authored brightness when the car leaves). 0 = car away (normal),
  // 1 = parked here (boosted). See the emissive loop + stations.js config.
  const arrivalGlow = useRef(0);
  // Set of material names whose emissive should lift on arrival, and by how
  // much. Pulled from the station config; absent on stations without a boost.
  const textBoost = station.arrivalTextBoost;
  const boostNames = textBoost?.materials;
  const boostMult = textBoost?.multiplier ?? 1;
  // Optional arrival-gated dim for a whole building's self-lit emissive: the
  // neon sits at `awayDim`× brightness while the car is elsewhere, then eases
  // back to full (1×) when the car parks at this station. Driven by the same
  // arrivalGlow as the text boost. Absent on stations that shouldn't dim.
  const awayDim = station.awayDim ?? null;

  // Cached outer-group scale so the world-space push distance is constant
  // regardless of each station's depth scaling.
  const depthScale = useMemo(() => depthProfileForStation(index).scale ?? 1, [index]);
  const isHovered = hoveredStationId === station.id;
  const isActive = currentIndex === index;
  const highlighted = isActive || isHovered;
  const arrivalActive =
    sceneReady && shouldActivateArrivalEffects({ station, currentIndex, isDriving });
  // When parked & focused at the welcome station, its monitor zooms up to fill
  // the frame — but the floating "01 WELCOME" label + its thin connector
  // cylinder are siblings that stay put, so the connector pierces the zoomed
  // terminal as a vertical "needle". Hide the label group in that one case.
  const hideLabel = station.id === 'welcome' && viewMode === 'tour' && isActive && !isDriving;

  useFrame((_, dt) => {
    const { viewMode, currentIndex: idx, isDriving, sceneReady } = useJourney.getState();
    const tour = viewMode === 'tour';
    const active = idx === index;

    const pTarget = !tour ? 1 : active ? 1 : NEIGHBOR_DIM;
    const bTarget = tour && active ? (isDriving ? 0.18 : 0.55) : 0;

    // Frame-rate independent easing.
    const k = 1 - Math.exp(-6 * Math.min(dt, 0.1));
    presence.current += (pTarget - presence.current) * k;
    beam.current += (bTarget - beam.current) * k;

    const aTarget = tour && !active ? 1 : 0;
    away.current += (aTarget - away.current) * k;

    // Arrival glow: 1 only while the car is parked here (active & not driving),
    // mirroring shouldActivateArrivalEffects. Eases back to 0 the moment the
    // car pulls away, restoring the text to its authored brightness.
    const arrivalTarget = sceneReady && active && !isDriving ? 1 : 0;
    arrivalGlow.current += (arrivalTarget - arrivalGlow.current) * k;

    const p = presence.current;
    const b = beam.current;
    const pLight = p * p; // lights/emissive fall off faster than opacity
    const full = p > 0.985;
    // Active building: boost its own lights with the beam. Others: dim.
    const lightScale = full ? 1 + b * FOCUS_BOOST : pLight;

    const grp = contentRef.current;
    if (grp) {
      // Push non-active stations away from the active one (tour). The
      // direction is "outward" from the active station's position, so the
      // stage clears regardless of how the route winds. Active: away=0.
      {
        const a = away.current;
        const act = stations[idx].position;
        const dx = station.position[0] - act[0];
        const dz = station.position[2] - act[2];
        const len = Math.hypot(dx, dz) || 1;
        grp.position.set(
          ((dx / len) * AWAY_DIST * a) / depthScale,
          (-AWAY_DROP * a) / depthScale,
          ((dz / len) * AWAY_DIST * a) / depthScale,
        );
        grp.scale.setScalar(1 - (1 - AWAY_SCALE) * a);
      }

      if (!dimmables.current) {
        const lights = [];
        const materials = [];
        grp.traverse((o) => {
          if (o.isLight) {
            lights.push({ light: o, baseIntensity: o.intensity });
            return;
          }
          const mat = o.material;
          if (!mat) return;
          const mats = Array.isArray(mat) ? mat : [mat];
          for (const m of mats) {
            // Ground-halo materials (outer ring / underglow / pulse) animate
            // their own opacity per-frame in Platform's useFrame. Pinning
            // them to a cached base here would overwrite that animation
            // every frame, so they're exempt from the dimmables loop.
            if (m.userData?.arrivalAnimated) continue;
            materials.push({
              material: m,
              baseOpacity: m.opacity ?? 1,
              baseTransparent: m.transparent,
              baseEmissiveIntensity:
                'emissiveIntensity' in m ? m.emissiveIntensity : undefined,
              baseColor: m.color ? m.color.clone() : null,
              // A self-lit building material — flagged by the emissiveMap that
              // `emissiveFromAlbedo` injects. Used to scope the arrival-gated
              // `awayDim` to the building only (not platforms / city dressing).
              selfLit: !!m.emissiveMap,
              // Whether this material's emissive should lift on arrival.
              // Matched by the GLB material name against the station config.
              boostsOnArrival: !!(boostNames && m.name && boostNames.includes(m.name)),
            });
          }
        });
        dimmables.current = { lights, materials };
      }

      for (const { light, baseIntensity } of dimmables.current.lights) {
        light.intensity = baseIntensity * lightScale;
      }

      for (const item of dimmables.current.materials) {
        const m = item.material;
        // Keep material transparency stable. Toggling many imported GLB
        // materials between opaque and transparent in Tour mode can trigger
        // expensive WebGL state churn and intermittent black frames.
        if (m.transparent !== item.baseTransparent) m.transparent = item.baseTransparent;
        if (m.opacity !== item.baseOpacity) m.opacity = item.baseOpacity;

        // Arrival-gated dim — only for THIS building's self-lit materials
        // (`selfLit`, i.e. they carry an emissiveMap from `emissiveFromAlbedo`),
        // so platforms and city dressing are left alone. Car away ⇒ awayDim×,
        // parked here ⇒ full (1×), eased by arrivalGlow.
        const dim =
          awayDim != null && item.selfLit
            ? awayDim + (1 - awayDim) * arrivalGlow.current
            : 1;

        if ('emissiveIntensity' in m && item.baseEmissiveIntensity !== undefined) {
          // Neighbor-dim (unchanged) × optional arrival boost. The boost only
          // applies to materials flagged in the station's `arrivalTextBoost`
          // and rides on `arrivalGlow` (0 = car away ⇒ ×1 ⇒ authored
          // brightness; 1 = parked ⇒ ×multiplier).
          const boost = item.boostsOnArrival
            ? 1 + arrivalGlow.current * (boostMult - 1)
            : 1;
          m.emissiveIntensity = item.baseEmissiveIntensity * (full ? 1 : pLight) * boost * dim;
        }

        // Dim the diffuse colour by the same factor too, so the WHOLE building
        // (not just its neon) darkens visibly when the car is away — dimming
        // emissive alone was too subtle to notice. Re-applied each frame from
        // the cached base colour, so it eases back to exactly the authored look.
        if (awayDim != null && item.selfLit && item.baseColor && m.color) {
          m.color.copy(item.baseColor).multiplyScalar(dim);
        }
      }
    }

  });

  return (
    <group
      position={station.position}
      scale={depthProfileForStation(index).scale}
      onClick={(e) => {
        e.stopPropagation();
        goTo(index);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHoveredStation(station.id);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHoveredStation(null);
        document.body.style.cursor = 'default';
      }}
    >
      {/* Dimmable station visuals */}
      <group ref={contentRef}>
        <group scale={station.platformScale ?? 1}>
          <Platform
            station={station}
            highlighted={highlighted}
            active={isActive}
            hovered={isHovered}
            arrivalActive={arrivalActive}
          />
        </group>
        <StationCityDressing station={station} />
        <Building station={station} />
        <FloatingNumber station={station} hidden={hideLabel} />
      </group>

      {/* Overhead light-beam removed: its custom additive shader compiled on
          first show when entering tour, which could stall a frame to black.
          The active building's own key light is still boosted (see useFrame). */}
    </group>
  );
}

/* -------------------- Platform -------------------- */
function Platform({ station, highlighted, active, hovered, arrivalActive = false }) {
  const palette = resolveStationPalette(station);
  const balance = resolveVisualBalance(station);
  const color = palette.primary;
  const buildingGlow = station.buildingGlow !== false;
  // Matte (non-glow) buildings have no self-emissive, so the warm key light is
  // ALL they get from the platform — cutting it to 0.58 made them read dark
  // next to the self-lit neon stations. Raised to 0.82 so every building in
  // the overview row sits in the same brightness band.
  const lightScale = buildingGlow ? 1 : 0.82;
  const arrivalReveal = useRef(0);
  const innerRingMatRef = useRef();
  const outerRingMatRef = useRef();
  const underglowMatRef = useRef();
  const pulseMatRef = useRef();
  const pulseRef = useRef();
  const arrivalInitial = resolvePlatformArrivalVisuals(station, { reveal: 0 });
  const blockPositions = [
    [-1.72, -0.2, -0.62, 0.58, 0.18, 0.72],
    [1.68, -0.21, 0.48, 0.62, 0.16, 0.68],
    [-0.8, -0.24, 1.28, 0.76, 0.16, 0.44],
    [0.94, -0.23, -1.32, 0.72, 0.16, 0.48],
  ];

  // All glowing rings (inner ring at the building's feet, outer ground
  // ring, underglow, pulse) animate up when the car parks here and fade
  // back out when it leaves — the inner ring to fully invisible, the outer
  // ground ring to a faint dark trace. Every station gets this treatment.
  // Steady-on platform accents (strips) are plain JSX props below.
  useFrame((state, delta) => {
    const k = 1 - Math.exp(-4.2 * Math.min(delta || 0.016, 0.1));
    arrivalReveal.current += ((arrivalActive ? 1 : 0) - arrivalReveal.current) * k;

    const visuals = resolvePlatformArrivalVisuals(station, {
      reveal: arrivalReveal.current,
    });
    // Per-station opt-out: `platformArrival.pulse: false` freezes the parked
    // throbbing entirely (rings hold a steady brightness — no oscillation).
    // Used by the contact station, where the pulsing read as "light jitter"
    // up close against its static neon text.
    const pulseEnabled = station.platformArrival?.pulse !== false;
    const pulse = arrivalActive && pulseEnabled
      ? 0.5 + 0.5 * Math.sin(state.clock.elapsedTime * 4.8)
      : 0;
    const pulseLift = visuals.reveal * pulse;

    if (innerRingMatRef.current) {
      innerRingMatRef.current.opacity = Math.min(1, visuals.innerRingOpacity + pulseLift * 0.04);
    }
    if (outerRingMatRef.current) {
      outerRingMatRef.current.opacity = Math.min(0.88, visuals.outerRingOpacity + pulseLift * 0.08);
    }
    if (underglowMatRef.current) {
      underglowMatRef.current.opacity = Math.min(0.26, visuals.underglowOpacity + pulseLift * 0.03);
    }
    if (pulseMatRef.current) {
      pulseMatRef.current.opacity = visuals.pulseOpacity * (0.35 + pulse * 0.65);
    }
    if (pulseRef.current) {
      const s = 1 + visuals.reveal * (0.055 + pulse * 0.045);
      pulseRef.current.scale.setScalar(s);
    }
  });

  // Steady-on platform accents: per-station overrides from `platformArrival`,
  // standard values otherwise. All RINGS (inner, outer, underglow, pulse)
  // start at their car-away state; useFrame animates them with arrival.
  const platformCfg = station.platformArrival ?? {};
  const stripOpacity = platformCfg.stripOn ?? 0.42;
  const innerRingOpacity = arrivalInitial.innerRingOpacity;
  const outerRingOpacity = arrivalInitial.outerRingOpacity;
  const underglowOpacity = arrivalInitial.underglowOpacity;

  return (
    <group>
      <mesh position={[0, -0.18, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[2.28, 2.55, 0.36, 8]} />
        <meshStandardMaterial
          color="#050912"
          roughness={0.82}
          metalness={0.18}
          flatShading
        />
      </mesh>
      {blockPositions.map(([x, y, z, w, h, d], i) => (
        <mesh key={i} position={[x, y, z]} receiveShadow castShadow>
          <boxGeometry args={[w, h, d]} />
          <meshStandardMaterial
            color={i % 2 === 0 ? '#070d18' : '#09111f'}
            roughness={0.78}
            metalness={0.22}
            flatShading
          />
        </mesh>
      ))}
      <mesh position={[0, 0.02, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[1.98, 2.08, 0.18, 10]} />
        <meshStandardMaterial
          color={palette.structure}
          roughness={0.62}
          metalness={0.38}
          flatShading
        />
      </mesh>
      <mesh position={[0, 0.12, 0]} receiveShadow>
        <cylinderGeometry args={[1.58, 1.64, 0.045, 32]} />
        <meshStandardMaterial
          color="#081426"
          roughness={0.48}
          metalness={0.62}
        />
      </mesh>

      <mesh position={[0, 0.151, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.59, 1.68, 64]} />
        <meshBasicMaterial
          ref={innerRingMatRef}
          color={color}
          toneMapped={false}
          transparent
          opacity={innerRingOpacity}
          userData={{ arrivalAnimated: true }}
        />
      </mesh>
      <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.04, 2.16, 64]} />
        <meshBasicMaterial
          ref={outerRingMatRef}
          color={color}
          toneMapped={false}
          transparent
          opacity={outerRingOpacity}
          depthWrite={false}
          userData={{ arrivalAnimated: true }}
        />
      </mesh>
      {/* Ground-halo arrival pulse: an additive ring sitting right on top of
          the outer ground ring, so the "光圈" on the ground visibly breathes
          up when the car parks here — and fades out when it leaves. */}
      <mesh ref={pulseRef} position={[0, -0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.0, 2.2, 72]} />
        <meshBasicMaterial
          ref={pulseMatRef}
          color={color}
          toneMapped={false}
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          userData={{ arrivalAnimated: true }}
        />
      </mesh>
      <mesh position={[0, -0.28, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[2.28, 48]} />
        <meshBasicMaterial
          ref={underglowMatRef}
          color={color}
          toneMapped={false}
          transparent
          opacity={underglowOpacity}
          depthWrite={false}
          userData={{ arrivalAnimated: true }}
        />
      </mesh>
      {[-1.2, -0.4, 0.4, 1.2].map((x, i) => (
        <mesh key={i} position={[x, 0.17, -1.72]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.42, 0.035]} />
          <meshBasicMaterial
            color={color}
            toneMapped={false}
            transparent
            opacity={stripOpacity}
          />
        </mesh>
      ))}

      {/* Per-station warm key light REMOVED (unified-lighting pass): every
          station used to ship its own warm (#fff0d8) point light with a
          per-station keyLight multiplier — 7 competing colour temperatures
          and brightness levels across the row, the main source of the
          "chaotic lighting" feedback. The single global moonlight rig in
          Environment.jsx now lights all stations identically; each
          building's colour identity comes from its own emissive
          materials + bloom. */}
    </group>
  );
}

/* -------------------- Floating number + title --------------------
   Labels are small relative to the buildings now — buildings are the
   visual hero, labels are supporting. They live in the top portion of
   the frame above each station, connected by a thin beam. */
function FloatingNumber({ station, hidden = false }) {
  const label = posterLabelForStation(station);
  const palette = resolveStationPalette(station);
  const glow = resolveGlowPolicy(station);

  return (
    <group position={[0, 6.55, 0.08]} visible={!hidden}>
      <Text
        fontSize={0.44}
        color="#a9d7ff"
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.08}
        outlineWidth={0.012}
        outlineColor="#030712"
      >
        {label.number}
      </Text>
      <Text
        position={[0, -0.31, 0]}
        fontSize={0.23}
        color="#f7fbff"
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.04}
        outlineWidth={0.01}
        outlineColor="#030712"
      >
        {label.title}
      </Text>
      <Text
        position={[0, -0.66, 0]}
        fontSize={0.145}
        color="#aab6cb"
        anchorX="center"
        anchorY="middle"
        maxWidth={1.9}
        textAlign="center"
        lineHeight={1.08}
        outlineWidth={0.006}
        outlineColor="#030712"
      >
        {label.subtitle}
      </Text>

      <mesh position={[0, -3.0, 0]}>
        <cylinderGeometry args={[0.008, 0.008, 5.2, 8]} />
        <meshBasicMaterial
          color={palette.primary}
          transparent
          opacity={glow.beamOpacity}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0, -3.0, 0]}>
        <cylinderGeometry args={[0.028, 0.028, 5.2, 8]} />
        <meshBasicMaterial
          color={palette.primary}
          transparent
          opacity={0.12}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[0, -0.98, 0]}>
        <sphereGeometry args={[0.075, 16, 16]} />
        <meshBasicMaterial color={palette.primary} toneMapped={false} />
      </mesh>
      {/* Accent pointLight removed: this marker is an emissive (unlit) sphere
          that glows via bloom regardless, so a real light here only added to
          the per-pixel light loop without changing the look. */}
      <mesh position={[0, -6.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.18, 0.24, 32]} />
        <meshBasicMaterial
          color={palette.primary}
          toneMapped={false}
          transparent
          opacity={0.72}
        />
      </mesh>
    </group>
  );
}

function StationCityDressing({ station }) {
  const palette = resolveStationPalette(station);
  const glow = resolveGlowPolicy(station);
  const dressing = useMemo(
    () => getStationDressingSpecs(station),
    [station.id, station.index, station.color],
  );

  return (
    <group position={[0, 0.12, 0]}>
      {dressing.structures.map((structure, i) => (
        <MicroArchitecture
          key={i}
          accent={palette.primary}
          structure={structure}
          windowOpacity={glow.windowOpacity}
        />
      ))}
      {dressing.pines.map((pine, i) => (
        <ArchitecturalPine
          key={i}
          position={[pine.x, 0, pine.z]}
          height={pine.height}
          color={station.index % 2 === 0 ? '#233a3c' : '#222f50'}
        />
      ))}
    </group>
  );
}

function MicroArchitecture({ structure, accent, windowOpacity }) {
  const { x, z, width, depth, height, crown } = structure;

  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.035, 0]} castShadow receiveShadow>
        <boxGeometry args={[width * 1.42, 0.07, depth * 1.4]} />
        <meshStandardMaterial
          color="#050914"
          roughness={0.58}
          metalness={0.48}
        />
      </mesh>

      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial
          color="#0d1728"
          roughness={0.46}
          metalness={0.62}
          flatShading
        />
      </mesh>

      <mesh position={[0, height / 2, depth / 2 + 0.004]}>
        <planeGeometry args={[width * 0.76, height * 0.82]} />
        <meshBasicMaterial
          color="#18314f"
          transparent
          opacity={0.22}
          depthWrite={false}
        />
      </mesh>

      <mesh position={[0, height - 0.08, depth / 2 + 0.008]}>
        <planeGeometry args={[width * 0.56, 0.024]} />
        <meshBasicMaterial
          color={accent}
          transparent
          opacity={0.52}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>

      {[0.34, 0.55, 0.76].map((row, i) => (
        <mesh key={i} position={[0, height * row, depth / 2 + 0.009]}>
          <planeGeometry args={[width * 0.42, 0.042]} />
          <meshBasicMaterial
            color={i === 1 ? '#fcd34d' : accent}
            toneMapped={false}
            transparent
            opacity={windowOpacity * (i === 1 ? 0.48 : 0.36)}
            depthWrite={false}
          />
        </mesh>
      ))}

      <MicroCrown
        accent={accent}
        crown={crown}
        depth={depth}
        height={height}
        width={width}
      />
    </group>
  );
}

function MicroCrown({ accent, crown, depth, height, width }) {
  const y = height + 0.065;

  if (crown === 'spire') {
    return (
      <group position={[0, y, 0]}>
        <mesh rotation={[0, Math.PI / 4, 0]} castShadow>
          <coneGeometry args={[width * 0.42, 0.24, 4]} />
          <meshStandardMaterial color="#172441" roughness={0.38} metalness={0.68} />
        </mesh>
        <mesh position={[0, 0.24, 0]}>
          <cylinderGeometry args={[0.008, 0.012, 0.42, 8]} />
          <meshBasicMaterial color={accent} transparent opacity={0.7} toneMapped={false} />
        </mesh>
      </group>
    );
  }

  if (crown === 'lantern') {
    return (
      <group position={[0, y, 0]}>
        <mesh castShadow>
          <boxGeometry args={[width * 0.58, 0.13, depth * 0.55]} />
          <meshStandardMaterial color="#172441" roughness={0.34} metalness={0.72} />
        </mesh>
        <mesh position={[0, 0.01, depth * 0.29]}>
          <planeGeometry args={[width * 0.36, 0.052]} />
          <meshBasicMaterial
            color={accent}
            toneMapped={false}
            transparent
            opacity={0.48}
            depthWrite={false}
          />
        </mesh>
      </group>
    );
  }

  if (crown === 'deco') {
    return (
      <group position={[0, y, 0]}>
        {[0, 1].map((i) => (
          <mesh key={i} position={[0, i * 0.055, 0]} castShadow>
            <boxGeometry
              args={[width * (0.78 - i * 0.16), 0.045, depth * (0.82 - i * 0.12)]}
            />
            <meshStandardMaterial color="#1a2947" roughness={0.34} metalness={0.72} />
          </mesh>
        ))}
        <mesh position={[0, 0.105, depth * 0.42]}>
          <planeGeometry args={[width * 0.52, 0.02]} />
          <meshBasicMaterial color="#fcd34d" transparent opacity={0.5} toneMapped={false} />
        </mesh>
      </group>
    );
  }

  if (crown === 'terrace') {
    return (
      <group position={[0, y, 0]}>
        <mesh castShadow>
          <boxGeometry args={[width * 0.86, 0.075, depth * 0.84]} />
          <meshStandardMaterial color="#14213a" roughness={0.38} metalness={0.66} />
        </mesh>
        <mesh position={[0, 0.052, 0]}>
          <boxGeometry args={[width * 0.62, 0.055, depth * 0.62]} />
          <meshStandardMaterial color="#0f1c33" roughness={0.38} metalness={0.7} />
        </mesh>
      </group>
    );
  }

  return (
    <mesh position={[0, y, 0]} castShadow>
      <boxGeometry args={[width * 0.74, 0.06, depth * 0.74]} />
      <meshStandardMaterial color="#111d34" roughness={0.42} metalness={0.66} />
    </mesh>
  );
}

function ArchitecturalPine({ position, height, color }) {
  return (
    <group position={position}>
      <mesh position={[0, height * 0.22, 0]} castShadow>
        <cylinderGeometry args={[0.028, 0.042, height * 0.42, 6]} />
        <meshStandardMaterial color="#111018" roughness={0.78} flatShading />
      </mesh>
      <mesh position={[0, height * 0.66, 0]} castShadow>
        <coneGeometry args={[height * 0.22, height * 0.5, 7]} />
        <meshStandardMaterial color={color} roughness={0.72} metalness={0.08} flatShading />
      </mesh>
      <mesh position={[0, height * 0.98, 0]} castShadow>
        <coneGeometry args={[height * 0.15, height * 0.36, 7]} />
        <meshStandardMaterial color="#304d73" roughness={0.72} metalness={0.1} flatShading />
      </mesh>
    </group>
  );
}

/* -------------------- Per-station building -------------------- */
// If a station defines a `model` (path to a .glb file under /public),
// load that and use it instead of the procedural placeholder. Each
// station's GLB is positioned so its origin sits at platform level
// — make sure your Blender model has the origin at the bottom-center
// before exporting.
function Building({ station }) {
  // Custom procedural component (no GLB), selected via `station.component`
  // in the station config. Supported: 'holoPortfolio', 'volunteerTimeline',
  // 'volunteerTower', 'contactConsole'.
  if (station.component === 'holoPortfolio') {
    return <HoloPortfolio station={station} />;
  }
  if (station.component === 'volunteerTimeline') {
    return <VolunteerTimeline station={station} />;
  }
  if (station.component === 'contactConsole') {
    return <ContactConsole station={station} />;
  }
  // Welcome station has its own interactive component:
  //   • Idle left/right sway
  //   • Animated code editor on the monitor screen
  if (station.id === 'welcome' && station.model) {
    return <WelcomeMonitor station={station} />;
  }
  if (station.model) {
    // A landmark GLB building. (Education's rooftop book was removed — the
    // Education experience now lives in the full-screen book overlay; see
    // src/ui/EducationBookOverlay.jsx.)
    return <GLBBuilding station={station} />;
  }
  switch (station.id) {
    case 'welcome':
      return <WorkstationBuilding color={station.color} />;
    case 'about':
      return <CozyHouse color={station.color} />;
    case 'skills':
      return <TechTower color={station.color} />;
    case 'projects':
      return <Factory color={station.color} />;
    case 'experience':
      return <OfficeTower color={station.color} />;
    case 'achievements':
      return <TrophyPedestal color={station.color} />;
    case 'contact':
      return <CommHub color={station.color} />;
    default:
      return null;
  }
}

// Loads a .glb and clones it so each station instance gets its own copy
// (so animations / mutations on one don't bleed into others). We also
// flip `castShadow` / `receiveShadow` on every mesh so the model
// integrates with the scene's lighting.
//
// Per-station tuning is read from the station object:
//   modelScale    — number or [x,y,z]. Default 1.
//   modelRotation — [x,y,z] in radians. Default [0,0,0].
//   modelOffset   — [x,y,z] world offset on top of the base lift. Default [0,0,0].
//
// You set these in src/data/stations.js after eyeballing your GLB.
function GLBBuilding({ station }) {
  const { scene } = useGLTF(station.model);
  const palette = resolveStationPalette(station);
  const glow = resolveGlowPolicy(station);
  const balance = resolveVisualBalance(station);
  const buildingGlow = station.buildingGlow !== false;

  // Static tilt around Y per station so the row has visual layering —
  // some buildings face slightly left, others right, like in the
  // reference poster. Configured per-station via `tiltY` (radians) in
  // src/data/stations.js. No continuous animation; the variation comes
  // from each building having its own fixed angle.
  const tiltY = station.tiltY ?? 0;

  // Shadows are opt-out per station. A self-lit GLB with hundreds of tiny,
  // near-coplanar meshes (e.g. the Connect hub: 227 meshes) doesn't need real
  // shadows — forcing every mesh to cast + receive floods the single shadow
  // map each frame and causes shadow-acne flicker on the thin glow/text
  // panels. Set `modelCastShadow: false` / `modelReceiveShadow: false` in
  // src/data/stations.js to skip it.
  const castShadow = station.modelCastShadow !== false;
  const receiveShadow = station.modelReceiveShadow !== false;

  const cloned = useMemo(() => {
    const c = scene.clone(true);
    // `modelHideMaterials` (material names) and `modelHideMeshes` (node/mesh
    // names) in src/data/stations.js remove meshes from the model — e.g. the
    // contact station hides its shimmer-prone thin glow strips and the front
    // border frame while keeping the corner/top/side accents.
    const hide = station.modelHideMaterials;
    const hideMeshes = station.modelHideMeshes;
    c.traverse((obj) => {
      if (obj.isMesh) {
        if (hide) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          if (mats.some((m) => m && hide.includes(m.name))) {
            obj.visible = false;
            return;
          }
        }
        if (
          hideMeshes &&
          (hideMeshes.includes(obj.name) || hideMeshes.includes(obj.parent?.name))
        ) {
          obj.visible = false;
          return;
        }
        obj.castShadow = castShadow;
        obj.receiveShadow = receiveShadow;
        // Some models (e.g. the volunteer tower) ship their own baked neon
        // emissive. Re-theming would override it — so opt out and keep the
        // GLB's materials exactly as authored.
        if (station.preserveModelMaterials) {
          // ...but if a baked emissive blooms too hot (e.g. neon text
          // overexposing), optionally dim it without otherwise touching the
          // authored look. `modelEmissiveScale` is either a single multiplier
          // for every material, or a { materialName: multiplier } map (with an
          // optional '*' fallback). Materials not listed keep their authored
          // intensity. See the contact station in src/data/stations.js.
          const es = station.modelEmissiveScale;
          if (es != null) {
            const scaleFor = (name) =>
              typeof es === 'number' ? es : es[name] ?? es['*'] ?? 1;
            const dimEmissive = (material) => {
              if (!material || !('emissiveIntensity' in material)) return material;
              const s = scaleFor(material.name);
              if (s === 1 && balance.emissiveScale === 1) return material;
              const next = material.clone();
              next.emissiveIntensity = (next.emissiveIntensity ?? 1) * s * balance.emissiveScale;
              return next;
            };
            obj.material = Array.isArray(obj.material)
              ? obj.material.map(dimEmissive)
              : dimEmissive(obj.material);
          }
          return;
        }
        const liftMaterial = (material) => {
          if (!material) return material;
          const next = material.clone();
          if (next.color) {
            next.color.multiplyScalar(glow.buildingColorLift);
            if (buildingGlow) {
              next.color.lerp(new THREE.Color('#dbeafe'), 0.08);
            } else {
              next.color.lerp(new THREE.Color('#8fa3c7'), 0.035);
            }
          }
          if ('roughness' in next) {
            const roughness = next.roughness ?? 0.62;
            next.roughness = buildingGlow
              ? Math.min(Math.max(roughness, 0.34), 0.54)
              : Math.min(Math.max(roughness, 0.42), 0.68);
          }
          if ('metalness' in next) {
            const metalness = next.metalness ?? 0.28;
            next.metalness = buildingGlow
              ? Math.min(Math.max(metalness, 0.38), 0.76)
              : Math.min(Math.max(metalness, 0.24), 0.56);
          }
          if ('emissive' in next) {
            if (buildingGlow) {
              next.emissive = new THREE.Color(palette.primary);
              next.emissiveIntensity = Math.max(
                next.emissiveIntensity ?? 0,
                glow.buildingMaterialEmissive,
              );
            } else if (station.emissiveFromAlbedo) {
              // Self-illuminate from the model's OWN base-color texture: white
              // emissive × the albedo map means only the bright/coloured texels
              // (e.g. this building's baked red neon lines & windows) light up
              // and pick up a Bloom halo. Turns a dark, busy scanned building
              // from "muddy" into a crisp, luminous neon landmark, without
              // washing the dark structure out. Tune `emissiveFromAlbedo` in
              // src/data/stations.js (higher = more glow).
              if (next.map) next.emissiveMap = next.map;
              next.emissive = new THREE.Color('#ffffff');
              next.emissiveIntensity = station.emissiveFromAlbedo;
            } else {
              next.emissive = new THREE.Color('#000000');
              next.emissiveIntensity = 0;
            }
          }
          return next;
        };

        obj.material = Array.isArray(obj.material)
          ? obj.material.map(liftMaterial)
          : liftMaterial(obj.material);
      }
    });
    return c;
  }, [
    scene,
    palette.primary,
    glow.buildingColorLift,
    glow.buildingMaterialEmissive,
    buildingGlow,
    station.preserveModelMaterials,
    station.modelEmissiveScale,
    station.emissiveFromAlbedo,
    balance.emissiveScale,
    castShadow,
    receiveShadow,
  ]);

  // Lift the model a tiny amount so it sits flush on the platform top,
  // then add any per-station offset on top of that.
  const baseLift = 0.06;
  const offset = station.modelOffset ?? [0, 0, 0];
  const position = [offset[0], baseLift + offset[1], offset[2]];
  const rotation = station.modelRotation ?? [0, 0, 0];
  const scale = station.modelScale ?? 1;

  return (
    <group rotation={[0, tiltY, 0]}>
      {glow.modelBackdropOpacity > 0 && (
        <mesh position={[0, 1.25, -0.2]} rotation={[0, 0, 0]}>
          <circleGeometry args={[1.55, 48]} />
          <meshBasicMaterial
            color={palette.primary}
            transparent
            opacity={glow.modelBackdropOpacity}
            toneMapped={false}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
      <primitive
        object={cloned}
        position={position}
        rotation={rotation}
        scale={scale}
      />
      {/* Optional custom neon sign mounted on the building face (e.g. the
          Education station's "EDUCATION" plate covering the baked UTAS text).
          Configured via `faceSign` in src/data/stations.js. */}
      {station.faceSign && <FaceSign {...station.faceSign} />}
      {/* Multi-row neon info panel on the Connect building face (CONNECT HUB /
          RESUME / GITHUB / LINKEDIN / EMAIL). Configured via `connectPanel` in
          src/data/stations.js. */}
      {station.connectPanel && <ConnectFaceSign {...station.connectPanel} />}
    </group>
  );
}

// Preload every model referenced in stations data so the dev experience
// is smooth when navigating between stations.
stations.forEach((s) => {
  if (s.model) useGLTF.preload(s.model);
});

/* ---------- 01 Welcome: a desk with glowing monitor ---------- */
function WorkstationBuilding({ color }) {
  return (
    <group position={[0, 0.06, 0]}>
      {/* Desk */}
      <mesh position={[0, 0.4, 0]} castShadow>
        <boxGeometry args={[1.2, 0.08, 0.7]} />
        <meshStandardMaterial color="#1a1f3a" roughness={0.55} metalness={0.4} />
      </mesh>
      {/* Desk legs */}
      <mesh position={[-0.5, 0.18, 0.28]} castShadow>
        <boxGeometry args={[0.08, 0.36, 0.08]} />
        <meshStandardMaterial color="#0e1426" />
      </mesh>
      <mesh position={[0.5, 0.18, 0.28]} castShadow>
        <boxGeometry args={[0.08, 0.36, 0.08]} />
        <meshStandardMaterial color="#0e1426" />
      </mesh>
      <mesh position={[-0.5, 0.18, -0.28]} castShadow>
        <boxGeometry args={[0.08, 0.36, 0.08]} />
        <meshStandardMaterial color="#0e1426" />
      </mesh>
      <mesh position={[0.5, 0.18, -0.28]} castShadow>
        <boxGeometry args={[0.08, 0.36, 0.08]} />
        <meshStandardMaterial color="#0e1426" />
      </mesh>
      {/* Monitor stand */}
      <mesh position={[0, 0.5, -0.1]} castShadow>
        <boxGeometry args={[0.08, 0.16, 0.08]} />
        <meshStandardMaterial color="#0e1426" />
      </mesh>
      {/* Monitor */}
      <mesh position={[0, 0.78, -0.1]} castShadow>
        <boxGeometry args={[0.95, 0.55, 0.06]} />
        <meshStandardMaterial color="#0a0d1f" metalness={0.6} roughness={0.3} />
      </mesh>
      {/* Screen (emissive) */}
      <mesh position={[0, 0.78, -0.065]}>
        <planeGeometry args={[0.86, 0.46]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      {/* Keyboard */}
      <mesh position={[0, 0.45, 0.2]} castShadow>
        <boxGeometry args={[0.6, 0.03, 0.18]} />
        <meshStandardMaterial color="#11183a" metalness={0.4} roughness={0.6} />
      </mesh>
      {/* Coffee mug */}
      <mesh position={[0.45, 0.48, 0.1]} castShadow>
        <cylinderGeometry args={[0.06, 0.06, 0.12, 12]} />
        <meshStandardMaterial color="#2a3160" />
      </mesh>
    </group>
  );
}

/* ---------- 02 About: cozy house ---------- */
function CozyHouse({ color }) {
  return (
    <group position={[0, 0.06, 0]}>
      {/* Walls */}
      <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.3, 1.0, 1.0]} />
        <meshStandardMaterial color="#2a2148" roughness={0.85} flatShading />
      </mesh>
      {/* Roof (pyramid) */}
      <mesh position={[0, 1.18, 0]} castShadow>
        <coneGeometry args={[1.0, 0.6, 4]} />
        <meshStandardMaterial color="#3b2a60" roughness={0.7} flatShading />
      </mesh>
      {/* Door */}
      <mesh position={[0, 0.34, 0.51]}>
        <planeGeometry args={[0.28, 0.5]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      {/* Windows (emissive) */}
      <mesh position={[-0.35, 0.65, 0.51]}>
        <planeGeometry args={[0.28, 0.22]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <mesh position={[0.35, 0.65, 0.51]}>
        <planeGeometry args={[0.28, 0.22]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      {/* Chimney */}
      <mesh position={[0.45, 1.35, -0.1]} castShadow>
        <boxGeometry args={[0.16, 0.4, 0.16]} />
        <meshStandardMaterial color="#2a2148" />
      </mesh>
    </group>
  );
}

/* ---------- 03 Skills: tech tower ---------- */
function TechTower({ color }) {
  return (
    <group position={[0, 0.06, 0]}>
      {/* Base */}
      <mesh position={[0, 0.18, 0]} castShadow>
        <cylinderGeometry args={[0.6, 0.75, 0.36, 8]} />
        <meshStandardMaterial color="#11183a" roughness={0.6} metalness={0.6} flatShading />
      </mesh>
      {/* Mid section */}
      <mesh position={[0, 0.85, 0]} castShadow>
        <cylinderGeometry args={[0.42, 0.5, 1.0, 8]} />
        <meshStandardMaterial color="#1a2342" roughness={0.45} metalness={0.7} flatShading />
      </mesh>
      {/* Light rings */}
      {[0.55, 0.95, 1.25].map((y, i) => (
        <mesh key={i} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.5, 0.025, 8, 24]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      ))}
      {/* Top capsule */}
      <mesh position={[0, 1.55, 0]} castShadow>
        <cylinderGeometry args={[0.32, 0.38, 0.4, 8]} />
        <meshStandardMaterial color="#243064" roughness={0.3} metalness={0.85} flatShading />
      </mesh>
      {/* Antenna */}
      <mesh position={[0, 2.0, 0]} castShadow>
        <cylinderGeometry args={[0.015, 0.015, 0.5, 6]} />
        <meshStandardMaterial color="#5a6ab0" />
      </mesh>
      <mesh position={[0, 2.28, 0]}>
        <sphereGeometry args={[0.04, 10, 10]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
    </group>
  );
}

/* ---------- 04 Projects: factory + crane ---------- */
function Factory({ color }) {
  return (
    <group position={[0, 0.06, 0]}>
      {/* Main building */}
      <mesh position={[-0.25, 0.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.0, 1.0, 1.0]} />
        <meshStandardMaterial color="#241a45" roughness={0.7} flatShading />
      </mesh>
      {/* Sawtooth roof */}
      {[-0.55, -0.25, 0.05].map((x, i) => (
        <mesh key={i} position={[x, 1.08, 0]} rotation={[0, 0, Math.PI / 4]} castShadow>
          <boxGeometry args={[0.28, 0.04, 1.0]} />
          <meshStandardMaterial color="#3a2a60" />
        </mesh>
      ))}
      {/* Storefront glow */}
      <mesh position={[-0.25, 0.5, 0.51]}>
        <planeGeometry args={[0.85, 0.5]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      {/* Crane base */}
      <mesh position={[0.65, 0.25, 0.2]} castShadow>
        <boxGeometry args={[0.18, 0.5, 0.18]} />
        <meshStandardMaterial color="#11183a" />
      </mesh>
      {/* Crane pole */}
      <mesh position={[0.65, 1.2, 0.2]} castShadow>
        <boxGeometry args={[0.08, 1.4, 0.08]} />
        <meshStandardMaterial color="#3a2a60" metalness={0.5} />
      </mesh>
      {/* Crane arm */}
      <mesh position={[0.3, 1.78, 0.2]} castShadow>
        <boxGeometry args={[0.78, 0.06, 0.08]} />
        <meshStandardMaterial color="#3a2a60" metalness={0.5} />
      </mesh>
      {/* Hanging hook */}
      <mesh position={[0.05, 1.45, 0.2]}>
        <boxGeometry args={[0.04, 0.6, 0.04]} />
        <meshStandardMaterial color="#5a6ab0" />
      </mesh>
      <mesh position={[0.05, 1.12, 0.2]}>
        <boxGeometry args={[0.12, 0.06, 0.12]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
    </group>
  );
}

/* ---------- 05 Experience: office tower ---------- */
function OfficeTower({ color }) {
  // Render window grid procedurally so it looks like a high rise.
  const windows = useMemo(() => {
    const list = [];
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 3; x++) {
        list.push([x, y]);
      }
    }
    return list;
  }, []);

  return (
    <group position={[0, 0.06, 0]}>
      {/* Tower body */}
      <mesh position={[0, 1.0, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.1, 2.0, 0.9]} />
        <meshStandardMaterial color="#1c1438" roughness={0.6} metalness={0.4} flatShading />
      </mesh>
      {/* Side annex */}
      <mesh position={[0.7, 0.6, 0]} castShadow>
        <boxGeometry args={[0.5, 1.2, 0.7]} />
        <meshStandardMaterial color="#2a2148" roughness={0.6} flatShading />
      </mesh>
      {/* Windows grid on front face */}
      {windows.map(([x, y], i) => (
        <mesh
          key={i}
          position={[(x - 1) * 0.32, 0.35 + y * 0.36, 0.46]}
        >
          <planeGeometry args={[0.22, 0.22]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      ))}
      {/* Annex windows */}
      {[0, 1, 2].map((y) => (
        <mesh key={y} position={[0.7, 0.3 + y * 0.36, 0.36]}>
          <planeGeometry args={[0.32, 0.22]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      ))}
      {/* Rooftop accent */}
      <mesh position={[0, 2.08, 0]} castShadow>
        <boxGeometry args={[0.45, 0.16, 0.45]} />
        <meshStandardMaterial color="#3a2a60" />
      </mesh>
    </group>
  );
}

/* ---------- 06 Achievements: trophy on pedestal ---------- */
function TrophyPedestal({ color }) {
  return (
    <group position={[0, 0.06, 0]}>
      {/* Pedestal */}
      <mesh position={[0, 0.3, 0]} castShadow>
        <boxGeometry args={[0.9, 0.6, 0.9]} />
        <meshStandardMaterial color="#2a2148" roughness={0.5} metalness={0.6} flatShading />
      </mesh>
      <mesh position={[0, 0.65, 0]} castShadow>
        <boxGeometry args={[1.0, 0.1, 1.0]} />
        <meshStandardMaterial color="#3a2a60" roughness={0.4} metalness={0.7} />
      </mesh>
      {/* Trophy cup base */}
      <mesh position={[0, 0.82, 0]} castShadow>
        <cylinderGeometry args={[0.18, 0.22, 0.12, 12]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.4}
          metalness={1.0}
          roughness={0.15}
          toneMapped={false}
        />
      </mesh>
      {/* Cup body */}
      <mesh position={[0, 1.1, 0]} castShadow>
        <cylinderGeometry args={[0.34, 0.2, 0.5, 14, 1, true]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.55}
          metalness={1.0}
          roughness={0.1}
          toneMapped={false}
          side={2}
        />
      </mesh>
      {/* Handles */}
      <mesh position={[-0.36, 1.1, 0]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.12, 0.025, 8, 18, Math.PI]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.5}
          metalness={0.9}
          roughness={0.2}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0.36, 1.1, 0]} rotation={[0, Math.PI, Math.PI / 2]}>
        <torusGeometry args={[0.12, 0.025, 8, 18, Math.PI]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.5}
          metalness={0.9}
          roughness={0.2}
          toneMapped={false}
        />
      </mesh>
      {/* Trophy point light removed (unified-lighting pass): the trophy's
          emissive material + bloom already make it glow; the real light only
          added another colour temperature to the scene. */}
    </group>
  );
}

/* ---------- 07 Contact: communication hub with dish ---------- */
function CommHub({ color }) {
  return (
    <group position={[0, 0.06, 0]}>
      {/* Base box */}
      <mesh position={[0, 0.45, 0]} castShadow>
        <boxGeometry args={[1.2, 0.9, 0.9]} />
        <meshStandardMaterial color="#2a1838" roughness={0.6} flatShading />
      </mesh>
      {/* Display panel */}
      <mesh position={[0, 0.55, 0.46]}>
        <planeGeometry args={[0.9, 0.5]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      {/* Dish stand */}
      <mesh position={[0, 1.05, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.06, 0.4, 8]} />
        <meshStandardMaterial color="#11183a" />
      </mesh>
      {/* Satellite dish (a flattened sphere) */}
      <mesh position={[0, 1.4, -0.1]} rotation={[0.6, 0, 0]} castShadow>
        <sphereGeometry args={[0.42, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#3a2a60" metalness={0.6} roughness={0.4} flatShading side={2} />
      </mesh>
      {/* Dish emitter */}
      <mesh position={[0, 1.42, 0.1]} rotation={[0.6, 0, 0]}>
        <sphereGeometry args={[0.06, 10, 10]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      {/* Side antenna */}
      <mesh position={[0.5, 0.95, 0]} castShadow>
        <cylinderGeometry args={[0.012, 0.012, 0.5, 6]} />
        <meshStandardMaterial color="#5a6ab0" />
      </mesh>
    </group>
  );
}
