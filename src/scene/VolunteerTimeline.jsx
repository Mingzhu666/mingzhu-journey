import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from './SafeText.jsx';
import * as THREE from 'three';

// VolunteerTimeline (station 6) — "Memorial Ziggurat" design.
//
// Where stations 05 and 07 are floating HUD panels, this station is
// an honest-to-goodness BUILDING — three solid stacked tiers with
// real architectural mass, each carrying a memorial plaque for one
// volunteer role. The visual hero is material and form, not glow.
//
// Why a ziggurat? Three roles → three tiers. The shape naturally
// reads as "building up over time" and gives each role its own
// physical level. It also makes the station feel like a monument /
// civic landmark, which fits the volunteering theme.
//
// Glow elements (architectural under-lighting strips, plaque
// emissives, top beacon) play a SUPPORTING role here — the chunky
// low-poly geometry is what carries the design.

const ACCENT = '#fde047';
const ACCENT_DEEP = '#fb923c';
const STONE_DARK = '#0c1224';
const STONE_MED = '#162039';
const STONE_LIGHT = '#2a3550';

const DEFAULT_ROLES = [
  {
    org: 'Lifeline Tasmania',
    years: '2018 – 2022',
    role: 'Crisis support volunteer',
    icon: 'heart',
  },
  {
    org: 'Aspect',
    years: '2022 – 2026',
    role: 'Autism Spectrum Australia',
    icon: 'infinity',
  },
  {
    org: 'The Youngsters',
    years: '2025 – 2026',
    role: 'Technical support',
    icon: 'code',
  },
];

// Tier widths shrink for the ziggurat silhouette. Oldest role at the
// bottom (largest tier, the "foundation"); newest at the top.
const TIERS = [
  { width: 2.2, height: 1.0, yBase: 0.2 }, // tier 0: 0.2 – 1.2
  { width: 1.7, height: 0.95, yBase: 1.25 }, // tier 1: 1.25 – 2.2
  { width: 1.25, height: 0.85, yBase: 2.25 }, // tier 2: 2.25 – 3.1
];

export default function VolunteerTimeline({ station }) {
  const scale = station.modelScale ?? 1;
  const roles = (station.roles ?? DEFAULT_ROLES).slice(0, 3);

  // Static tilt only — the monumental building reads better when it
  // isn't moving. Angle comes from `station.tiltY` in stations.js.
  const tiltY = station.tiltY ?? 0;

  return (
    <group position={[0, 0.06, 0]} scale={scale} rotation={[0, tiltY, 0]}>
      <Foundation />

      {/* The three stacked architectural tiers */}
      {TIERS.map((tier, i) => (
        <Tier
          key={i}
          width={tier.width}
          height={tier.height}
          yBase={tier.yBase}
          role={roles[i]}
        />
      ))}

      {/* Top beacon and spire */}
      <Beacon />

      {/* Floating header above */}
      <Header />
    </group>
  );
}

/* ───────────────────────── Foundation ─────────────────────────
   A wide square base with stepped detail in front. Provides the
   "this is a monument" gravity. */
function Foundation() {
  return (
    <group>
      {/* Widest bottom plate */}
      <mesh position={[0, -0.005, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.85, 0.05, 2.85]} />
        <meshStandardMaterial
          color="#04060f"
          metalness={0.7}
          roughness={0.5}
          flatShading
        />
      </mesh>

      {/* Main foundation block */}
      <mesh position={[0, 0.1, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.6, 0.2, 2.6]} />
        <meshStandardMaterial
          color={STONE_DARK}
          metalness={0.85}
          roughness={0.32}
          flatShading
        />
      </mesh>

      {/* Top accent rim around foundation */}
      <mesh position={[0, 0.205, 0]}>
        <boxGeometry args={[2.62, 0.012, 2.62]} />
        <meshBasicMaterial color={ACCENT} toneMapped={false} />
      </mesh>

      {/* Decorative step in front of foundation */}
      <mesh position={[0, 0.04, 1.45]} castShadow receiveShadow>
        <boxGeometry args={[1.6, 0.08, 0.25]} />
        <meshStandardMaterial
          color={STONE_MED}
          metalness={0.7}
          roughness={0.4}
          flatShading
        />
      </mesh>
      <mesh position={[0, 0.08, 1.55]} castShadow receiveShadow>
        <boxGeometry args={[1.3, 0.16, 0.15]} />
        <meshStandardMaterial
          color={STONE_LIGHT}
          metalness={0.8}
          roughness={0.35}
          flatShading
        />
      </mesh>

      {/* Inscribed sigil on the front step (golden ring + dot) */}
      <mesh position={[0, 0.085, 1.555]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.06, 0.075, 32]} />
        <meshBasicMaterial color={ACCENT} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.086, 1.556]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.02, 16]} />
        <meshBasicMaterial color={ACCENT} toneMapped={false} />
      </mesh>

      {/* Corner ornaments on top of the foundation — small obelisks */}
      {[
        [1.15, 1.15],
        [-1.15, 1.15],
        [1.15, -1.15],
        [-1.15, -1.15],
      ].map(([x, z], i) => (
        <group key={i} position={[x, 0.21, z]}>
          <mesh castShadow>
            <boxGeometry args={[0.14, 0.18, 0.14]} />
            <meshStandardMaterial
              color={STONE_LIGHT}
              metalness={0.85}
              roughness={0.25}
              flatShading
            />
          </mesh>
          {/* Pyramidal cap */}
          <mesh position={[0, 0.13, 0]} castShadow>
            <coneGeometry args={[0.1, 0.08, 4]} />
            <meshStandardMaterial
              color={STONE_LIGHT}
              metalness={0.85}
              roughness={0.25}
            />
          </mesh>
          {/* Glowing tip */}
          <mesh position={[0, 0.18, 0]}>
            <sphereGeometry args={[0.018, 10, 10]} />
            <meshBasicMaterial color={ACCENT} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ───────────────────────── Tier ─────────────────────────
   A single stacked level of the ziggurat. Built from:
     • The main solid block (the bulk of the tier)
     • A bevel cap on top (slightly wider — gives the "overhang" feel)
     • Architectural under-lighting strip (emissive band beneath the cap)
     • A memorial plaque on the front face
     • Decorative window slits on left + right sides */
function Tier({ width, height, yBase, role }) {
  const yCenter = yBase + height / 2;
  const topCapY = yBase + height + 0.04;
  const overhang = 0.1;

  return (
    <group position={[0, 0, 0]}>
      {/* Main tier body */}
      <mesh position={[0, yCenter, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, height, width]} />
        <meshStandardMaterial
          color={STONE_DARK}
          metalness={0.78}
          roughness={0.36}
          flatShading
        />
      </mesh>

      {/* Slight inset on each face for depth */}
      {[1, -1].map((sx, i) => (
        <mesh
          key={`face-x-${i}`}
          position={[sx * (width / 2 - 0.005), yCenter, 0]}
          rotation={[0, sx === 1 ? Math.PI / 2 : -Math.PI / 2, 0]}
        >
          <planeGeometry args={[width - 0.2, height - 0.12]} />
          <meshStandardMaterial
            color={STONE_MED}
            metalness={0.85}
            roughness={0.28}
            flatShading
          />
        </mesh>
      ))}
      <mesh
        position={[0, yCenter, -width / 2 + 0.005]}
        rotation={[0, Math.PI, 0]}
      >
        <planeGeometry args={[width - 0.2, height - 0.12]} />
        <meshStandardMaterial
          color={STONE_MED}
          metalness={0.85}
          roughness={0.28}
          flatShading
        />
      </mesh>

      {/* Beveled top cap (slightly wider — ziggurat overhang) */}
      <mesh position={[0, topCapY, 0]} castShadow>
        <boxGeometry args={[width + overhang, 0.08, width + overhang]} />
        <meshStandardMaterial
          color={STONE_LIGHT}
          metalness={0.9}
          roughness={0.22}
          flatShading
        />
      </mesh>

      {/* Architectural under-eave lighting strip — emissive band right
          beneath the cap, like recessed building lighting */}
      <mesh position={[0, topCapY - 0.045, 0]}>
        <boxGeometry args={[width + overhang - 0.02, 0.014, width + overhang - 0.02]} />
        <meshBasicMaterial color={ACCENT} toneMapped={false} />
      </mesh>

      {/* Bottom moulding — a thin accent line at the base of the tier */}
      <mesh position={[0, yBase + 0.02, 0]}>
        <boxGeometry args={[width + 0.02, 0.012, width + 0.02]} />
        <meshStandardMaterial
          color={STONE_LIGHT}
          metalness={0.9}
          roughness={0.25}
        />
      </mesh>

      {/* Decorative window slits — small emissive squares on left + right sides */}
      <WindowSlits width={width} height={height} yCenter={yCenter} />

      {/* Plaque on the front face — sized proportionally to the tier */}
      {role && (
        <Plaque
          position={[0, yCenter + 0.02, width / 2 + 0.011]}
          width={width * 0.85}
          height={height * 0.62}
          role={role}
        />
      )}
    </group>
  );
}

/* Small emissive window slits on the left and right sides of each
   tier — gives the building "lit interior" character without showing
   any interior. */
function WindowSlits({ width, height, yCenter }) {
  // Two horizontal rows of three slits each on each side.
  const cols = 3;
  const slitW = 0.05;
  const slitH = 0.14;
  const rows = [yCenter - 0.18, yCenter + 0.18];

  return (
    <group>
      {[1, -1].map((sx) =>
        rows.map((y, ri) =>
          Array.from({ length: cols }).map((_, ci) => {
            const z = -width / 2 + 0.18 + (ci * (width - 0.36)) / (cols - 1);
            return (
              <mesh
                key={`${sx}-${ri}-${ci}`}
                position={[sx * (width / 2 + 0.003), y, z]}
                rotation={[0, sx === 1 ? Math.PI / 2 : -Math.PI / 2, 0]}
              >
                <planeGeometry args={[slitW, slitH]} />
                <meshBasicMaterial
                  color={ACCENT}
                  transparent
                  opacity={0.85}
                  toneMapped={false}
                />
              </mesh>
            );
          }),
        ),
      )}
    </group>
  );
}

/* ───────────────────────── Plaque ─────────────────────────
   A real memorial plaque embedded in the front face of each tier.
   Made of a metallic frame around a dark inset, with engraved-looking
   gold text and a small inscribed icon. Recessed slightly so it
   reads as part of the building, not floating UI. */
function Plaque({ position, width, height, role }) {
  return (
    <group position={position}>
      {/* Metal frame (slightly larger than inner panel) */}
      <mesh position={[0, 0, -0.005]} castShadow>
        <boxGeometry args={[width, height, 0.025]} />
        <meshStandardMaterial
          color="#4a5780"
          metalness={0.95}
          roughness={0.18}
          flatShading
        />
      </mesh>

      {/* Inset dark panel */}
      <mesh position={[0, 0, 0.009]}>
        <planeGeometry args={[width - 0.06, height - 0.06]} />
        <meshStandardMaterial
          color="#070a18"
          metalness={0.6}
          roughness={0.5}
        />
      </mesh>

      {/* Year (top line) */}
      <Text
        position={[-(width - 0.18) / 2, height / 2 - 0.1, 0.015]}
        fontSize={height * 0.085}
        color={ACCENT}
        anchorX="left"
        anchorY="middle"
        letterSpacing={0.1}
        outlineWidth={0.002}
        outlineColor="#000"
      >
        {role.years.toUpperCase()}
      </Text>

      {/* Divider under year */}
      <mesh position={[0, height / 2 - 0.18, 0.015]}>
        <planeGeometry args={[width - 0.16, 0.0035]} />
        <meshBasicMaterial
          color={ACCENT}
          transparent
          opacity={0.7}
          toneMapped={false}
        />
      </mesh>

      {/* Org name (large center) */}
      <Text
        position={[-(width - 0.18) / 2, 0.0, 0.015]}
        fontSize={height * 0.16}
        color="#f0e4c4"
        anchorX="left"
        anchorY="middle"
        maxWidth={width - 0.42}
        outlineWidth={0.003}
        outlineColor="#000"
      >
        {role.org}
      </Text>

      {/* Role caption */}
      <Text
        position={[-(width - 0.18) / 2, -height / 2 + 0.14, 0.015]}
        fontSize={height * 0.08}
        color="#a0a8c0"
        anchorX="left"
        anchorY="middle"
        maxWidth={width - 0.42}
      >
        {role.role}
      </Text>

      {/* Engraved icon on the right side of the plaque */}
      <EngraveIcon
        type={role.icon}
        position={[width / 2 - 0.16, 0, 0.015]}
        size={height * 0.4}
      />

      {/* 4 corner rivets */}
      {[
        [-(width / 2) + 0.05, height / 2 - 0.05],
        [width / 2 - 0.05, height / 2 - 0.05],
        [-(width / 2) + 0.05, -height / 2 + 0.05],
        [width / 2 - 0.05, -height / 2 + 0.05],
      ].map(([rx, ry], i) => (
        <group key={i} position={[rx, ry, 0.012]}>
          <mesh>
            <cylinderGeometry args={[0.015, 0.015, 0.008, 10]} />
            <meshStandardMaterial
              color="#6a7290"
              metalness={0.95}
              roughness={0.2}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* Engraved icons on the plaque. Small, gold, no animations — they're
   supposed to feel inscribed in metal, not animated holograms. */
function EngraveIcon({ type, position, size }) {
  switch (type) {
    case 'heart':
      return <HeartGlyph position={position} size={size} />;
    case 'infinity':
      return <InfinityGlyph position={position} size={size} />;
    case 'code':
      return <CodeGlyph position={position} size={size} />;
    default:
      return null;
  }
}

function HeartGlyph({ position, size }) {
  const s = size / 0.3;
  return (
    <group position={position}>
      <mesh position={[-0.035 * s, 0.035 * s, 0]}>
        <sphereGeometry args={[0.04 * s, 14, 14]} />
        <meshBasicMaterial color={ACCENT} toneMapped={false} />
      </mesh>
      <mesh position={[0.035 * s, 0.035 * s, 0]}>
        <sphereGeometry args={[0.04 * s, 14, 14]} />
        <meshBasicMaterial color={ACCENT} toneMapped={false} />
      </mesh>
      <mesh position={[0, -0.045 * s, 0]} rotation={[0, 0, Math.PI]}>
        <coneGeometry args={[0.055 * s, 0.1 * s, 3]} />
        <meshBasicMaterial color={ACCENT} toneMapped={false} />
      </mesh>
    </group>
  );
}

function InfinityGlyph({ position, size }) {
  const s = size / 0.3;
  return (
    <group position={position}>
      <mesh position={[-0.045 * s, 0, 0]}>
        <torusGeometry args={[0.04 * s, 0.012 * s, 10, 32]} />
        <meshBasicMaterial color={ACCENT} toneMapped={false} />
      </mesh>
      <mesh position={[0.045 * s, 0, 0]}>
        <torusGeometry args={[0.04 * s, 0.012 * s, 10, 32]} />
        <meshBasicMaterial color={ACCENT} toneMapped={false} />
      </mesh>
    </group>
  );
}

function CodeGlyph({ position, size }) {
  return (
    <Text
      position={position}
      fontSize={size * 0.7}
      color={ACCENT}
      anchorX="center"
      anchorY="middle"
      outlineWidth={0.003}
      outlineColor="#000"
    >
      {'</>'}
    </Text>
  );
}

/* ───────────────────────── Beacon ─────────────────────────
   Top of the ziggurat — a pyramidal spire with a floating glowing
   orb above it that gently bobs. Reads as "ongoing impact". */
function Beacon() {
  const orbRef = useRef();
  const haloRef = useRef();

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (orbRef.current) {
      orbRef.current.position.y = 3.62 + Math.sin(t * 1.3) * 0.04;
    }
    if (haloRef.current) {
      const pulse = 1 + Math.sin(t * 2.0) * 0.18;
      haloRef.current.scale.setScalar(pulse);
    }
  });

  return (
    <group>
      {/* Cap base on top of tier 3 (a flat plinth) */}
      <mesh position={[0, 3.16, 0]} castShadow>
        <boxGeometry args={[0.65, 0.06, 0.65]} />
        <meshStandardMaterial
          color={STONE_LIGHT}
          metalness={0.92}
          roughness={0.22}
          flatShading
        />
      </mesh>

      {/* Pyramidal spire */}
      <mesh position={[0, 3.35, 0]} castShadow>
        <coneGeometry args={[0.18, 0.32, 4]} />
        <meshStandardMaterial
          color={STONE_LIGHT}
          metalness={0.95}
          roughness={0.18}
          flatShading
        />
      </mesh>

      {/* Spire tip — a small gold ball at the apex */}
      <mesh position={[0, 3.52, 0]}>
        <sphereGeometry args={[0.05, 14, 14]} />
        <meshBasicMaterial color={ACCENT} toneMapped={false} />
      </mesh>

      {/* Floating orb above the spire (the "beacon") */}
      <mesh ref={orbRef} position={[0, 3.62, 0]}>
        <sphereGeometry args={[0.11, 18, 18]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </mesh>

      {/* Pulsing halo around the orb */}
      <mesh ref={haloRef} position={[0, 3.62, 0]}>
        <sphereGeometry args={[0.18, 16, 16]} />
        <meshBasicMaterial
          color={ACCENT}
          transparent
          opacity={0.38}
          toneMapped={false}
        />
      </mesh>

      {/* Beam of light from orb upward (very thin) */}
      <mesh position={[0, 3.85, 0]}>
        <cylinderGeometry args={[0.012, 0.04, 0.6, 8, 1, true]} />
        <meshBasicMaterial
          color={ACCENT}
          transparent
          opacity={0.35}
          toneMapped={false}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

/* ───────────────────────── Header ─────────────────────────
   A different style again from 05/07: a banner-style stone tablet
   floating above the spire's beam. Reads as "monument signage". */
function Header() {
  return (
    <group position={[0, 4.35, 0]}>
      {/* Tablet body */}
      <mesh castShadow>
        <boxGeometry args={[1.7, 0.32, 0.08]} />
        <meshStandardMaterial
          color={STONE_MED}
          metalness={0.92}
          roughness={0.22}
          flatShading
        />
      </mesh>
      {/* Tablet edge highlights */}
      <mesh position={[0, 0.16, 0.041]}>
        <planeGeometry args={[1.7, 0.005]} />
        <meshBasicMaterial color={ACCENT} toneMapped={false} />
      </mesh>
      <mesh position={[0, -0.16, 0.041]}>
        <planeGeometry args={[1.7, 0.005]} />
        <meshBasicMaterial color={ACCENT} toneMapped={false} />
      </mesh>
      {/* Side bevel caps */}
      {[-0.85, 0.85].map((x, i) => (
        <mesh key={i} position={[x, 0, 0.041]}>
          <planeGeometry args={[0.015, 0.32]} />
          <meshBasicMaterial color={ACCENT} toneMapped={false} />
        </mesh>
      ))}
      {/* Title text */}
      <Text
        position={[0, 0, 0.042]}
        fontSize={0.13}
        color={ACCENT}
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.14}
        outlineWidth={0.005}
        outlineColor="#000"
      >
        VOLUNTEERING
      </Text>
      {/* Decorative diamond ornaments at each end */}
      {[-0.72, 0.72].map((x, i) => (
        <mesh
          key={`dia-${i}`}
          position={[x, 0, 0.045]}
          rotation={[0, 0, Math.PI / 4]}
        >
          <planeGeometry args={[0.04, 0.04]} />
          <meshBasicMaterial color={ACCENT} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}
