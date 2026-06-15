import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import { Text } from './SafeText.jsx';
import * as THREE from 'three';
import { useJourney } from '../state/useJourney.js';

// ContactConsole (station 7) — "Signal Hub" design.
//
// Third HUD station, third visual vocabulary. To keep stations 05/06/07
// from blurring together, this one uses geometry the others don't:
//
//   • Circular discs (the contact buttons) — not rectangles (05) and
//     not octahedrons (06).
//   • A central armillary sphere (three perpendicular torus rings) —
//     not a wireframe shape (06) and not a cube (05).
//   • A 4-way cross layout (cardinal directions around the sphere) —
//     not a 2×2 grid (05) and not a 3D zigzag (06).
//   • A square pedestal — not circular (05) or hexagonal (06).
//   • Sonar-style signal rings continuously emanating outward from the
//     sphere, suggesting "broadcasting".
//
// Color world is the station's cool blue (#8db7ff) instead of warm
// gold, which also reinforces the "different from 06" feel.

const ACCENT = '#8db7ff';
const ACCENT_DEEP = '#3b82f6';
const ACCENT_BRIGHT = '#dbeafe';
// HDR title colour (>1 so Bloom haloes "LET'S CONNECT"). Module-level
// constant so the troika `color` prop identity is stable across renders.
const TITLE_COLOR_HDR = new THREE.Color(2.0, 2.1, 2.4);

const HUB_Y = 2.05; // height of the central sphere (also: button cross center)
const BUTTON_RADIUS = 0.3;
const ORBIT_RADIUS = 1.25;

// 4 slots arranged in a cross around the central hub. Each slot has a
// fixed position and a default label-offset direction so the typography
// doesn't overlap the central armillary.
const BUTTON_SLOTS = {
  github: {
    position: [-ORBIT_RADIUS, HUB_Y, 0],
    labelOffset: [0, -0.5, 0],
    valueOffset: [0, -0.62, 0],
  },
  linkedin: {
    position: [ORBIT_RADIUS, HUB_Y, 0],
    labelOffset: [0, -0.5, 0],
    valueOffset: [0, -0.62, 0],
  },
  resume: {
    position: [0, HUB_Y + ORBIT_RADIUS, 0],
    labelOffset: [0, 0.5, 0],
    valueOffset: [0, 0.62, 0],
  },
  email: {
    position: [0, HUB_Y - ORBIT_RADIUS, 0],
    labelOffset: [0, -0.5, 0],
    valueOffset: [0, -0.62, 0],
  },
};

const DEFAULT_CONTACTS = [
  { slot: 'github', label: 'GITHUB', value: 'github.com/yourname', action: 'open', href: '' },
  { slot: 'linkedin', label: 'LINKEDIN', value: '/in/yourname', action: 'open', href: '' },
  { slot: 'email', label: 'EMAIL', value: 'you@example.com', action: 'copy', href: 'mailto:you@example.com' },
  { slot: 'resume', label: 'RESUME', value: 'Download PDF', action: 'open', href: '' },
];

export default function ContactConsole({ station }) {
  const scale = station.modelScale ?? 1;
  const contacts = station.contacts ?? DEFAULT_CONTACTS;
  const currentIndex = useJourney((s) => s.currentIndex);
  const viewMode = useJourney((s) => s.viewMode);
  const contactFeedback = useJourney((s) => s.contactFeedback);
  const triggerContactFeedback = useJourney((s) => s.triggerContactFeedback);
  const clearContactFeedback = useJourney((s) => s.clearContactFeedback);
  const feedbackTimer = useRef(null);
  const interactive = viewMode === 'tour' && currentIndex === station.index - 1;

  // Static tilt only — sphere/buttons stay still, only inner
  // animations (armillary rotation, signal rings, tether pulses) move.
  const tiltY = station.tiltY ?? 0;

  useEffect(() => () => {
    if (feedbackTimer.current) window.clearTimeout(feedbackTimer.current);
  }, []);

  const showFeedback = (payload) => {
    if (feedbackTimer.current) window.clearTimeout(feedbackTimer.current);
    triggerContactFeedback(payload);
    feedbackTimer.current = window.setTimeout(() => {
      clearContactFeedback();
      feedbackTimer.current = null;
    }, 2200);
  };

  const handleContactAction = async (contact) => {
    const label = contact.label ?? contact.slot;
    if (contact.action === 'copy') {
      try {
        if (!navigator.clipboard) throw new Error('Clipboard unavailable');
        await navigator.clipboard.writeText(contact.value);
        showFeedback({ slot: contact.slot, kind: 'success', message: `${label} copied` });
      } catch {
        if (contact.href) {
          window.location.href = contact.href;
          showFeedback({ slot: contact.slot, kind: 'success', message: `Opening ${label}` });
        } else {
          showFeedback({ slot: contact.slot, kind: 'warn', message: `${label} unavailable` });
        }
      }
      return;
    }

    if (contact.href) {
      window.open(contact.href, '_blank', 'noopener,noreferrer');
      showFeedback({ slot: contact.slot, kind: 'success', message: `Opening ${label}` });
      return;
    }

    showFeedback({
      slot: contact.slot,
      kind: 'warn',
      message: contact.slot === 'resume' ? 'Resume not configured yet' : `${label} unavailable`,
    });
  };

  return (
    <group position={[0, 0.06, 0]} scale={scale} rotation={[0, tiltY, 0]}>
      <SquarePedestal />
      <ArmillarySphere />
      <SignalRings />

      {contacts.slice(0, 4).map((c) => {
        const slot = BUTTON_SLOTS[c.slot];
        if (!slot) return null;
        return (
          <group key={c.slot}>
            <Tether from={[0, HUB_Y, 0]} to={slot.position} />
            <ContactButton
              contact={c}
              position={slot.position}
              labelOffset={slot.labelOffset}
              valueOffset={slot.valueOffset}
              interactive={interactive}
              feedbackActive={contactFeedback?.slot === c.slot}
              onAction={handleContactAction}
            />
          </group>
        );
      })}

      <Header />
    </group>
  );
}

/* ───────────────────────── Square pedestal ─────────────────────────
   Boxy 4-sided platform (different from circular HoloPortfolio or
   hex VolunteerTimeline pedestals). The top surface carries a
   circuit-board-style grid pattern that ties visually to the
   "console / transmitter" theme. */
function SquarePedestal() {
  const halfSide = 1.25;
  return (
    <group>
      {/* Main square block */}
      <mesh position={[0, 0.1, 0]} castShadow receiveShadow>
        <boxGeometry args={[halfSide * 2, 0.2, halfSide * 2]} />
        <meshStandardMaterial
          color="#08111f"
          metalness={0.85}
          roughness={0.28}
          flatShading
        />
      </mesh>

      {/* Lower outer plate */}
      <mesh position={[0, -0.005, 0]} castShadow receiveShadow>
        <boxGeometry args={[halfSide * 2 + 0.25, 0.05, halfSide * 2 + 0.25]} />
        <meshStandardMaterial
          color="#040711"
          metalness={0.55}
          roughness={0.5}
        />
      </mesh>

      {/* Bright accent strips along the top edges of the square */}
      {[
        [0, halfSide], // back edge
        [0, -halfSide], // front edge
      ].map(([_, z], i) => (
        <mesh key={`x${i}`} position={[0, 0.201, z]}>
          <boxGeometry args={[halfSide * 2, 0.005, 0.025]} />
          <meshBasicMaterial color={ACCENT} toneMapped={false} />
        </mesh>
      ))}
      {[
        [halfSide, 0],
        [-halfSide, 0],
      ].map(([x, _], i) => (
        <mesh key={`z${i}`} position={[x, 0.201, 0]}>
          <boxGeometry args={[0.025, 0.005, halfSide * 2]} />
          <meshBasicMaterial color={ACCENT} toneMapped={false} />
        </mesh>
      ))}

      {/* Tech-detail bolts at each corner of the top */}
      {[
        [halfSide - 0.12, halfSide - 0.12],
        [-halfSide + 0.12, halfSide - 0.12],
        [halfSide - 0.12, -halfSide + 0.12],
        [-halfSide + 0.12, -halfSide + 0.12],
      ].map(([x, z], i) => (
        <group key={`c${i}`} position={[x, 0.202, z]}>
          <mesh>
            <cylinderGeometry args={[0.04, 0.04, 0.012, 8]} />
            <meshStandardMaterial
              color="#1a2540"
              metalness={0.85}
              roughness={0.3}
            />
          </mesh>
          <mesh position={[0, 0.008, 0]}>
            <cylinderGeometry args={[0.012, 0.012, 0.005, 8]} />
            <meshBasicMaterial color={ACCENT} toneMapped={false} />
          </mesh>
        </group>
      ))}

      {/* Center "transmission grid" pattern */}
      <TransmissionGrid />
    </group>
  );
}

/* Circuit-board grid + emissive nodes on top of the pedestal. */
function TransmissionGrid() {
  // 5×5 grid of thin lines + bright dots at intersections.
  const half = 0.7;
  const lines = useMemo(() => {
    const out = [];
    const N = 5;
    const step = (half * 2) / (N - 1);
    for (let i = 0; i < N; i++) {
      const v = -half + i * step;
      // Vertical line (z-axis)
      out.push({ orientation: 'z', pos: v });
      // Horizontal line (x-axis)
      out.push({ orientation: 'x', pos: v });
    }
    return out;
  }, [half]);

  return (
    <group position={[0, 0.21, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      {lines.map((line, i) => (
        <mesh
          key={i}
          position={[
            line.orientation === 'x' ? 0 : line.pos,
            line.orientation === 'x' ? line.pos : 0,
            0,
          ]}
        >
          <planeGeometry
            args={
              line.orientation === 'x' ? [half * 2, 0.003] : [0.003, half * 2]
            }
          />
          <meshBasicMaterial
            color={ACCENT}
            transparent
            opacity={0.35}
            toneMapped={false}
          />
        </mesh>
      ))}
      {/* Bright nodes at every other intersection */}
      {[-half, -half / 2, 0, half / 2, half].flatMap((x, i) =>
        [-half, -half / 2, 0, half / 2, half].map((y, j) => {
          if ((i + j) % 2 !== 0) return null;
          return (
            <mesh key={`${i}-${j}`} position={[x, y, 0.001]}>
              <circleGeometry args={[0.012, 12]} />
              <meshBasicMaterial color={ACCENT_BRIGHT} toneMapped={false} />
            </mesh>
          );
        }),
      )}
      {/* Central bright disc */}
      <mesh position={[0, 0, 0.001]}>
        <circleGeometry args={[0.07, 24]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </mesh>
    </group>
  );
}

/* ───────────────────────── Armillary sphere ─────────────────────────
   Three perpendicular torus rings (equator + 2 meridians) rotating
   together around the sphere center, plus a glowing solid core.
   Different from HoloPortfolio's central wireframe cube and
   VolunteerTimeline's wireframe octahedrons. */
function ArmillarySphere() {
  const ringsRef = useRef();
  const coreRef = useRef();

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (ringsRef.current) {
      ringsRef.current.rotation.y = t * 0.4;
      ringsRef.current.rotation.x = Math.sin(t * 0.3) * 0.4;
    }
    if (coreRef.current) {
      coreRef.current.scale.setScalar(1 + Math.sin(t * 2.5) * 0.1);
    }
  });

  const R = 0.55;
  const tubeR = 0.012;

  return (
    <group position={[0, HUB_Y, 0]}>
      {/* Outer ambient halo (very soft) */}
      <mesh>
        <sphereGeometry args={[R * 1.7, 24, 24]} />
        <meshBasicMaterial
          color={ACCENT}
          transparent
          opacity={0.05}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>

      {/* The three perpendicular rings, rotating together */}
      <group ref={ringsRef}>
        {/* Equator (horizontal) */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[R, tubeR, 12, 64]} />
          <meshBasicMaterial color={ACCENT} toneMapped={false} />
        </mesh>
        {/* Meridian along Y-Z plane */}
        <mesh>
          <torusGeometry args={[R, tubeR, 12, 64]} />
          <meshBasicMaterial color={ACCENT} toneMapped={false} />
        </mesh>
        {/* Meridian along X-Y plane */}
        <mesh rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[R, tubeR, 12, 64]} />
          <meshBasicMaterial color={ACCENT} toneMapped={false} />
        </mesh>

        {/* Bright "axis poles" at the top + bottom of the equator */}
        <mesh position={[0, R, 0]}>
          <sphereGeometry args={[0.04, 12, 12]} />
          <meshBasicMaterial color={ACCENT_BRIGHT} toneMapped={false} />
        </mesh>
        <mesh position={[0, -R, 0]}>
          <sphereGeometry args={[0.04, 12, 12]} />
          <meshBasicMaterial color={ACCENT_BRIGHT} toneMapped={false} />
        </mesh>
      </group>

      {/* Glowing inner sphere (solid, pulsing) */}
      <mesh>
        <sphereGeometry args={[0.25, 24, 24]} />
        <meshBasicMaterial
          color={ACCENT}
          transparent
          opacity={0.5}
          toneMapped={false}
        />
      </mesh>

      {/* Bright pulsating core */}
      <mesh ref={coreRef}>
        <sphereGeometry args={[0.12, 18, 18]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </mesh>
    </group>
  );
}

/* ───────────────────────── Signal rings ─────────────────────────
   Sonar-style expanding rings around the sphere. Reads as
   "broadcasting in all directions" — the visual story of the
   Contact station. */
const SIGNAL_COUNT = 3;
const SIGNAL_PERIOD = 3.2;

function SignalRings() {
  const refs = useRef([]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    for (let i = 0; i < SIGNAL_COUNT; i++) {
      const ref = refs.current[i];
      if (!ref) continue;
      const phase = ((t / SIGNAL_PERIOD) + i / SIGNAL_COUNT) % 1;
      const radius = 0.6 + phase * 1.4;
      ref.scale.set(radius, radius, radius);
      ref.material.opacity = (1 - phase) * 0.4;
    }
  });

  return (
    <group position={[0, HUB_Y, 0]} rotation={[Math.PI / 2, 0, 0]}>
      {Array.from({ length: SIGNAL_COUNT }, (_, i) => (
        <mesh key={i} ref={(el) => (refs.current[i] = el)}>
          <ringGeometry args={[1.0, 1.015, 64]} />
          <meshBasicMaterial
            color={ACCENT}
            transparent
            toneMapped={false}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

/* ───────────────────────── Tether (line + traveling pulse) ───────────────────────── */
function Tether({ from, to }) {
  const pulseRef = useRef();

  useFrame((state) => {
    if (!pulseRef.current) return;
    const t = state.clock.elapsedTime;
    // Two pulses per cycle, offset slightly, so each tether feels alive.
    const phase = ((t * 0.45) % 1);
    pulseRef.current.position.set(
      from[0] + (to[0] - from[0]) * phase,
      from[1] + (to[1] - from[1]) * phase,
      from[2] + (to[2] - from[2]) * phase,
    );
    pulseRef.current.material.opacity =
      Math.min(phase * 5, (1 - phase) * 5, 1) * 0.95;
  });

  return (
    <group>
      <Line
        points={[from, to]}
        color={ACCENT}
        lineWidth={1.2}
        transparent
        opacity={0.45}
      />
      <mesh ref={pulseRef}>
        <sphereGeometry args={[0.03, 10, 10]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

/* ───────────────────────── Contact button ─────────────────────────
   Round disc (NOT a card, NOT a crystal) with an icon centered on it
   and a label + value floating just outside. Slow vertical bob. */
function ContactButton({
  contact,
  position,
  labelOffset,
  valueOffset,
  interactive = false,
  feedbackActive = false,
  onAction,
}) {
  const groupRef = useRef();
  const ringRef = useRef();

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;
    // Subtle hover bob
    groupRef.current.position.set(
      position[0],
      position[1] + Math.sin(t * 1.4 + position[0] * 2) * 0.025,
      position[2],
    );
    if (ringRef.current) {
      ringRef.current.rotation.z = t * 0.2 * (position[0] >= 0 ? 1 : -1);
    }
  });

  return (
    <group
      ref={groupRef}
      position={position}
      onClick={(e) => {
        if (!interactive) return;
        e.stopPropagation();
        onAction?.(contact);
      }}
      onPointerOver={(e) => {
        if (!interactive) return;
        e.stopPropagation();
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        if (!interactive) return;
        document.body.style.cursor = 'default';
      }}
    >
      {/* Translucent dark fill */}
      <mesh position={[0, 0, -0.002]}>
        <circleGeometry args={[BUTTON_RADIUS - 0.02, 36]} />
        <meshBasicMaterial
          color="#070b1a"
          transparent
          opacity={feedbackActive ? 0.96 : 0.85}
          toneMapped={false}
        />
      </mesh>

      {/* Bright outer ring */}
      <mesh>
        <ringGeometry args={[BUTTON_RADIUS - 0.01, BUTTON_RADIUS, 48]} />
        <meshBasicMaterial color={feedbackActive ? ACCENT_BRIGHT : ACCENT} toneMapped={false} />
      </mesh>

      {/* Inner thinner ring */}
      <mesh>
        <ringGeometry args={[BUTTON_RADIUS - 0.06, BUTTON_RADIUS - 0.052, 48]} />
        <meshBasicMaterial
          color={ACCENT}
          transparent
          opacity={feedbackActive ? 0.95 : 0.55}
          toneMapped={false}
        />
      </mesh>

      {/* Dashed outer ring that slowly rotates (gives "scanning" feel) */}
      <mesh ref={ringRef}>
        <ringGeometry
          args={[BUTTON_RADIUS + 0.04, BUTTON_RADIUS + 0.052, 24, 1, 0, Math.PI * 1.45]}
        />
        <meshBasicMaterial
          color={ACCENT}
          transparent
          opacity={feedbackActive ? 1 : 0.6}
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {feedbackActive && (
        <mesh position={[0, 0, -0.004]}>
          <circleGeometry args={[BUTTON_RADIUS + 0.18, 42]} />
          <meshBasicMaterial
            color={ACCENT}
            transparent
            opacity={0.12}
            toneMapped={false}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* Centered icon */}
      <ContactIcon type={contact.slot} position={[0, 0.03, 0.005]} />

      {/* Label */}
      <Text
        position={labelOffset}
        fontSize={0.072}
        color={feedbackActive ? ACCENT_BRIGHT : '#ffffff'}
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.14}
        outlineWidth={0.003}
        outlineColor="#000"
      >
        {contact.label}
      </Text>

      {/* Value (smaller, accent color, just below the label) */}
      {contact.value && (
        <Text
          position={valueOffset}
          fontSize={0.038}
          color={feedbackActive ? ACCENT_BRIGHT : ACCENT}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.001}
          outlineColor="#000"
        >
          {contact.value}
        </Text>
      )}
    </group>
  );
}

/* ───────────────────────── Icons ───────────────────────── */
function ContactIcon({ type, position }) {
  switch (type) {
    case 'github':
      return <GithubIcon position={position} />;
    case 'linkedin':
      return <LinkedInIcon position={position} />;
    case 'email':
      return <EmailIcon position={position} />;
    case 'resume':
      return <ResumeIcon position={position} />;
    default:
      return null;
  }
}

/* GitHub: a tiny git-branch graph (3 nodes connected). */
function GithubIcon({ position }) {
  const pts = [
    [0, 0.07, 0], // top node
    [-0.06, -0.04, 0], // bottom-left
    [0.06, -0.04, 0], // bottom-right
  ];
  return (
    <group position={position}>
      {pts.map(([x, y], i) => (
        <mesh key={i} position={[x, y, 0]}>
          <circleGeometry args={[0.022, 16]} />
          <meshBasicMaterial color={ACCENT} toneMapped={false} />
        </mesh>
      ))}
      <Line
        points={[pts[0], pts[1]]}
        color={ACCENT}
        lineWidth={1.5}
      />
      <Line
        points={[pts[0], pts[2]]}
        color={ACCENT}
        lineWidth={1.5}
      />
      <Line
        points={[pts[1], pts[2]]}
        color={ACCENT}
        lineWidth={1}
        transparent
        opacity={0.5}
      />
    </group>
  );
}

/* LinkedIn: stylized "in" text glyph. */
function LinkedInIcon({ position }) {
  return (
    <Text
      position={position}
      fontSize={0.13}
      color={ACCENT}
      anchorX="center"
      anchorY="middle"
      outlineWidth={0.004}
      outlineColor="#000"
      fontWeight={700}
    >
      in
    </Text>
  );
}

/* Email: envelope outline + V-fold flap. */
function EmailIcon({ position }) {
  return (
    <group position={position}>
      <mesh>
        <planeGeometry args={[0.16, 0.11]} />
        <meshBasicMaterial
          color={ACCENT}
          transparent
          opacity={0.18}
          toneMapped={false}
        />
      </mesh>
      <Line
        points={[
          [-0.08, 0.055, 0],
          [0.08, 0.055, 0],
          [0.08, -0.055, 0],
          [-0.08, -0.055, 0],
          [-0.08, 0.055, 0],
        ]}
        color={ACCENT}
        lineWidth={1.5}
      />
      {/* Envelope flap V */}
      <Line
        points={[
          [-0.08, 0.055, 0],
          [0, -0.005, 0],
          [0.08, 0.055, 0],
        ]}
        color={ACCENT}
        lineWidth={1.5}
      />
    </group>
  );
}

/* Resume: document with horizontal text lines. */
function ResumeIcon({ position }) {
  return (
    <group position={position}>
      <mesh>
        <planeGeometry args={[0.12, 0.16]} />
        <meshBasicMaterial
          color={ACCENT}
          transparent
          opacity={0.18}
          toneMapped={false}
        />
      </mesh>
      <Line
        points={[
          [-0.06, 0.08, 0],
          [0.06, 0.08, 0],
          [0.06, -0.08, 0],
          [-0.06, -0.08, 0],
          [-0.06, 0.08, 0],
        ]}
        color={ACCENT}
        lineWidth={1.5}
      />
      {/* Text lines */}
      {[0.04, 0.0, -0.04].map((y, i) => (
        <mesh key={i} position={[0, y, 0]}>
          <planeGeometry args={[0.09, 0.005]} />
          <meshBasicMaterial
            color={ACCENT}
            transparent
            opacity={0.85}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

/* ───────────────────────── Header ─────────────────────────
   Corner brackets only — no full frame. Different from HoloPortfolio's
   hex frame and VolunteerTimeline's parallel rules. */
function Header() {
  const halfW = 0.85;
  const halfH = 0.18;
  const titleRef = useRef();

  // Push the title into HDR (user request: the last station's lettering was
  // too dim). The HDR colour rides troika's per-instance `color` prop (see
  // TITLE_COLOR_HDR); here we only pull the materials out of tone mapping so
  // the >1 colour reaches Bloom intact. Array-safe: with outline props set,
  // troika's `material` getter returns [outlineMaterial, mainMaterial] — a
  // plain `material.color.setRGB` here would throw every frame and kill the
  // render loop. Per-frame because troika creates its derived materials
  // asynchronously after font load.
  useFrame(() => {
    const txt = titleRef.current;
    if (!txt || !txt.material) return;
    const mats = Array.isArray(txt.material) ? txt.material : [txt.material];
    for (const m of mats) {
      if (m && m.toneMapped !== false) m.toneMapped = false;
    }
  });

  return (
    <group position={[0, 3.75, 0]}>
      <CornerBracket position={[-halfW, halfH, 0]} corner="tl" />
      <CornerBracket position={[halfW, halfH, 0]} corner="tr" />
      <CornerBracket position={[-halfW, -halfH, 0]} corner="bl" />
      <CornerBracket position={[halfW, -halfH, 0]} corner="br" />
      {/* Title */}
      <Text
        ref={titleRef}
        fontSize={0.14}
        color={TITLE_COLOR_HDR}
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.14}
        outlineWidth={0.008}
        outlineColor={ACCENT}
        outlineOpacity={0.85}
      >
        LET&apos;S CONNECT
      </Text>
      {/* Small decorative dot row above the title */}
      <DotRow y={0.27} count={5} width={0.5} />
    </group>
  );
}

function CornerBracket({ position, corner }) {
  // L-shaped corner mark made from two short emissive bars.
  const arm = 0.11;
  const t = 0.006;
  // Determine which directions the arms point based on corner type
  const xSign = corner.includes('r') ? -1 : 1; // arms point inward
  const ySign = corner.includes('b') ? 1 : -1;
  return (
    <group position={position}>
      {/* Horizontal arm */}
      <mesh position={[xSign * arm / 2, 0, 0]}>
        <planeGeometry args={[arm, t]} />
        <meshBasicMaterial color={ACCENT} toneMapped={false} />
      </mesh>
      {/* Vertical arm */}
      <mesh position={[0, ySign * arm / 2, 0]}>
        <planeGeometry args={[t, arm]} />
        <meshBasicMaterial color={ACCENT} toneMapped={false} />
      </mesh>
      {/* Tiny corner dot */}
      <mesh>
        <circleGeometry args={[0.015, 10]} />
        <meshBasicMaterial color={ACCENT_BRIGHT} toneMapped={false} />
      </mesh>
    </group>
  );
}

function DotRow({ y, count, width }) {
  const spacing = width / (count - 1);
  return (
    <group position={[0, y, 0]}>
      {Array.from({ length: count }, (_, i) => (
        <mesh
          key={i}
          position={[-width / 2 + i * spacing, 0, 0]}
        >
          <circleGeometry args={[i === Math.floor(count / 2) ? 0.012 : 0.007, 10]} />
          <meshBasicMaterial
            color={ACCENT}
            transparent
            opacity={i === Math.floor(count / 2) ? 1 : 0.5}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}
