import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import { Text } from './SafeText.jsx';
import * as THREE from 'three';
import { useJourney } from '../state/useJourney.js';

// HoloPortfolio — a procedural HUD station for "Projects". Instead of
// cramming four tiny cards into a 2×2 grid (which read as mush at this
// scale), it shows ONE project big and crisp as a "hero" panel, with the
// rest as a clickable thumbnail rail beneath it. Click a thumbnail (or the
// ‹ › arrows) to bring a project into focus.
//
// Why this shape: the value of this station is its content, so legibility
// wins. A single large panel can use real font sizes and breathing room;
// the pedestal + beam ground it so it doesn't feel like text floating in
// the void; the thumbnail rail keeps all four projects discoverable.

const ACCENT = '#6ee7ff';
const ACCENT_DEEP = '#4dc4f5';
const PANEL_BG = '#070b1f';
const WHITE = '#ffffff';
const DIM = '#9fb0d8';

// Default content (overridable via `projects` in src/data/stations.js).
const DEFAULT_PROJECTS = [
  {
    num: '01',
    title: 'English Study Hub',
    tags: ['Web App', 'Education', 'AI'],
    description:
      'An all-in-one platform for English learners to practice, track progress, and improve with AI guidance.',
    visual: 'screen',
  },
  {
    num: '02',
    title: '3D Interactive Portfolio',
    tags: ['Three.js', 'WebGL', '3D'],
    description:
      'An immersive 3D portfolio experience to showcase projects with interactive animations and smooth transitions.',
    visual: 'cube',
  },
  {
    num: '03',
    title: 'Redis-like KV Store in Go',
    tags: ['Go', 'Data Structure', 'System'],
    description:
      'A high-performance in-memory key-value database inspired by Redis with multiple data structures and persistence.',
    visual: 'stack',
  },
  {
    num: '04',
    title: 'GPT-like LM from Scratch',
    tags: ['Python', 'NLP', 'Transformer'],
    description:
      'A GPT-style decoder-only transformer implemented from scratch with training, inference, and text generation.',
    visual: 'transformer',
  },
];

const FOOTER_BADGES = [
  { label: 'INNOVATION', icon: 'bulb' },
  { label: 'CODE', icon: 'code' },
  { label: 'CREATIVITY', icon: 'palette' },
  { label: 'IMPACT', icon: 'globe' },
];

// --- Hero panel geometry (local units, before the group scale) ---
const HERO_W = 2.6;
const HERO_H = 1.5;
const HERO_CY = 2.5;
const HERO_LEFT = -HERO_W / 2 + 0.16; // left content margin

export default function HoloPortfolio({ station }) {
  const projects = (station.projects ?? DEFAULT_PROJECTS).slice(0, 4);
  const activeProjectIndex = useJourney((s) => s.activeProjectIndex);
  const setActiveProject = useJourney((s) => s.setActiveProject);
  const currentIndex = useJourney((s) => s.currentIndex);
  const viewMode = useJourney((s) => s.viewMode);
  const interactive = viewMode === 'tour' && currentIndex === station.index - 1;
  const scale = station.modelScale ?? 1;
  const tiltY = station.tiltY ?? 0;

  const total = projects.length;
  const idx = ((activeProjectIndex % total) + total) % total;
  const active = projects[idx] ?? projects[0];

  const goRel = (delta) => setActiveProject((idx + delta + total) % total);

  return (
    <group position={[0, 0.06, 0]} scale={scale} rotation={[0, tiltY, 0]}>
      <Pedestal />
      <CentralBeam />
      <FooterBadges />
      <PortfolioHeader />

      <HeroPanel project={active} index={idx} total={total} />

      {/* Prev / next arrows flanking the hero */}
      {interactive && (
        <>
          <NavArrow position={[-HERO_W / 2 - 0.2, HERO_CY, 0]} dir="left" onClick={() => goRel(-1)} />
          <NavArrow position={[HERO_W / 2 + 0.2, HERO_CY, 0]} dir="right" onClick={() => goRel(1)} />
        </>
      )}

      <ThumbnailRail
        projects={projects}
        activeIndex={idx}
        interactive={interactive}
        onSelect={(i) => setActiveProject(i)}
      />
    </group>
  );
}

/* ───────────────────────── Hero panel ───────────────────────── */
function HeroPanel({ project, index, total }) {
  const grpRef = useRef();
  const lastIdx = useRef(index);
  const t0 = useRef(-1);

  // A gentle "pop" each time the focused project changes.
  useFrame((state) => {
    const now = state.clock.elapsedTime;
    if (index !== lastIdx.current) {
      lastIdx.current = index;
      t0.current = now;
    }
    if (grpRef.current) {
      const p = t0.current < 0 ? 1 : Math.min(1, (now - t0.current) / 0.28);
      const e = 1 - Math.pow(1 - p, 3);
      grpRef.current.scale.setScalar(0.95 + 0.05 * e);
    }
  });

  const { num, title, tags, description, visual } = project;

  return (
    <group ref={grpRef} position={[0, HERO_CY, 0]}>
      {/* Soft glow plate behind the panel */}
      <mesh position={[0, 0, -0.03]}>
        <planeGeometry args={[HERO_W + 0.5, HERO_H + 0.5]} />
        <meshBasicMaterial color={ACCENT} transparent opacity={0.05} toneMapped={false} depthWrite={false} />
      </mesh>

      {/* Panel background */}
      <mesh position={[0, 0, -0.01]}>
        <planeGeometry args={[HERO_W, HERO_H]} />
        <meshBasicMaterial color={PANEL_BG} transparent opacity={0.86} toneMapped={false} />
      </mesh>

      {/* Two clean frames (thicker than the old 1px lines so bloom doesn't smear them) */}
      <HexFrame width={HERO_W + 0.07} height={HERO_H + 0.07} color={ACCENT_DEEP} opacity={0.45} lineWidth={2} />
      <HexFrame width={HERO_W} height={HERO_H} color={ACCENT} opacity={1} lineWidth={2.6} />
      <CornerTicks width={HERO_W} height={HERO_H} />

      {/* Meta line: PROJECT 0X / 0N */}
      <Text
        position={[HERO_LEFT, HERO_H / 2 - 0.14, 0.01]}
        fontSize={0.058}
        color={DIM}
        anchorX="left"
        anchorY="middle"
        letterSpacing={0.06}
      >
        {`PROJECT ${num} / ${String(total).padStart(2, '0')}`}
      </Text>

      {/* Number + title */}
      <Text
        position={[HERO_LEFT, HERO_H / 2 - 0.38, 0.01]}
        fontSize={0.13}
        color={WHITE}
        anchorX="left"
        anchorY="top"
        maxWidth={1.42}
        lineHeight={1.05}
        outlineWidth={0.004}
        outlineColor="#020712"
      >
        {title}
      </Text>

      {/* Divider under the title block */}
      <mesh position={[HERO_LEFT + 0.69, HERO_H / 2 - 0.74, 0.005]}>
        <planeGeometry args={[1.42, 0.004]} />
        <meshBasicMaterial color={ACCENT} transparent opacity={0.5} toneMapped={false} />
      </mesh>

      {/* Tags */}
      <HeroTags tags={tags} x={HERO_LEFT} y={HERO_H / 2 - 0.86} />

      {/* Description */}
      <Text
        position={[HERO_LEFT, HERO_H / 2 - 1.0, 0.01]}
        fontSize={0.05}
        color={DIM}
        anchorX="left"
        anchorY="top"
        maxWidth={1.34}
        lineHeight={1.42}
      >
        {description}
      </Text>

      {/* Visual on the right, on its own framed sub-panel */}
      <group position={[0.8, -0.04, 0]}>
        <mesh position={[0, 0, -0.006]}>
          <planeGeometry args={[0.92, 0.92]} />
          <meshBasicMaterial color="#0a1024" transparent opacity={0.6} toneMapped={false} />
        </mesh>
        <HexFrame width={0.92} height={0.92} color={ACCENT} opacity={0.45} lineWidth={1.6} />
        <group scale={1.7} position={[0, 0, 0.02]}>
          <CardVisual type={visual} position={[0, 0, 0]} />
        </group>
      </group>
    </group>
  );
}

function HeroTags({ tags, x, y }) {
  let cursor = x;
  const out = [];
  const charW = 0.03;
  const pad = 0.055;
  const gap = 0.06;
  const h = 0.1;
  (tags ?? []).forEach((t, i) => {
    const w = t.length * charW + pad * 2;
    out.push(<HeroTag key={i} text={t} position={[cursor + w / 2, y, 0.01]} width={w} height={h} />);
    cursor += w + gap;
  });
  return <group>{out}</group>;
}

function HeroTag({ text, position, width, height }) {
  return (
    <group position={position}>
      <mesh position={[0, 0, -0.002]}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial color="#16203f" transparent opacity={0.82} toneMapped={false} />
      </mesh>
      <HexFrame width={width} height={height} color={ACCENT} opacity={0.85} lineWidth={1.4} />
      <Text fontSize={0.046} color={ACCENT} anchorX="center" anchorY="middle">
        {text}
      </Text>
    </group>
  );
}

/* ───────────────────────── Nav arrows ───────────────────────── */
function NavArrow({ position, dir, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <group
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = 'default';
      }}
    >
      {/* Hit area */}
      <mesh>
        <circleGeometry args={[0.16, 24]} />
        <meshBasicMaterial color={ACCENT} transparent opacity={hovered ? 0.18 : 0.08} toneMapped={false} />
      </mesh>
      <HexFrame width={0.28} height={0.28} color={ACCENT} opacity={hovered ? 1 : 0.6} lineWidth={1.8} />
      <Text
        position={[dir === 'left' ? -0.005 : 0.005, 0.004, 0.01]}
        fontSize={0.14}
        color={hovered ? WHITE : ACCENT}
        anchorX="center"
        anchorY="middle"
      >
        {dir === 'left' ? '‹' : '›'}
      </Text>
    </group>
  );
}

/* ───────────────────────── Thumbnail rail ───────────────────────── */
const THUMB_W = 0.58;
const THUMB_H = 0.42;
const THUMB_GAP = 0.1;
const RAIL_Y = 1.42;

function ThumbnailRail({ projects, activeIndex, interactive, onSelect }) {
  const total = projects.length;
  const span = total * THUMB_W + (total - 1) * THUMB_GAP;
  const startX = -span / 2 + THUMB_W / 2;
  return (
    <group position={[0, RAIL_Y, 0]}>
      {projects.map((p, i) => (
        <Thumbnail
          key={p.num ?? i}
          position={[startX + i * (THUMB_W + THUMB_GAP), 0, 0]}
          project={p}
          active={i === activeIndex}
          interactive={interactive}
          onSelect={() => onSelect(i)}
        />
      ))}
    </group>
  );
}

function Thumbnail({ position, project, active, interactive, onSelect }) {
  const [hovered, setHovered] = useState(false);
  const { num, title } = project;
  const lift = active ? 0.05 : hovered ? 0.03 : 0;
  const z = active ? 0.06 : hovered ? 0.03 : 0;
  const bgOpacity = active ? 0.92 : hovered ? 0.8 : 0.55;
  const frameOpacity = active ? 1 : hovered ? 0.85 : 0.4;
  const numColor = active ? ACCENT : hovered ? WHITE : '#7d88b4';
  const titleColor = active ? WHITE : '#9aa6cf';
  const short = (title ?? '').length > 16 ? `${title.slice(0, 15)}…` : title;

  return (
    <group
      position={[position[0], position[1] + lift, z]}
      onClick={(e) => {
        if (!interactive) return;
        e.stopPropagation();
        onSelect?.();
      }}
      onPointerOver={(e) => {
        if (!interactive) return;
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        if (!interactive) return;
        setHovered(false);
        document.body.style.cursor = 'default';
      }}
    >
      <mesh position={[0, 0, -0.002]}>
        <planeGeometry args={[THUMB_W, THUMB_H]} />
        <meshBasicMaterial color={active ? '#0c1430' : PANEL_BG} transparent opacity={bgOpacity} toneMapped={false} />
      </mesh>
      <HexFrame width={THUMB_W} height={THUMB_H} color={ACCENT} opacity={frameOpacity} lineWidth={active ? 2.2 : 1.5} />

      {active && (
        <mesh position={[0, 0, -0.004]}>
          <planeGeometry args={[THUMB_W + 0.12, THUMB_H + 0.12]} />
          <meshBasicMaterial color={ACCENT} transparent opacity={0.08} toneMapped={false} depthWrite={false} />
        </mesh>
      )}

      {/* Top accent bar for the active thumb */}
      {active && (
        <mesh position={[0, THUMB_H / 2 - 0.03, 0.004]}>
          <planeGeometry args={[THUMB_W - 0.12, 0.018]} />
          <meshBasicMaterial color={ACCENT} toneMapped={false} />
        </mesh>
      )}

      <Text
        position={[-THUMB_W / 2 + 0.08, THUMB_H / 2 - 0.12, 0.01]}
        fontSize={0.08}
        color={numColor}
        anchorX="left"
        anchorY="middle"
        outlineWidth={0.003}
        outlineColor="#020712"
      >
        {num}
      </Text>
      <Text
        position={[-THUMB_W / 2 + 0.08, -0.04, 0.01]}
        fontSize={0.044}
        color={titleColor}
        anchorX="left"
        anchorY="top"
        maxWidth={THUMB_W - 0.16}
        lineHeight={1.15}
      >
        {short}
      </Text>
    </group>
  );
}

/* ───────────────────────── Pedestal ───────────────────────── */
function Pedestal() {
  return (
    <group>
      <mesh position={[0, 0.1, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.45, 1.55, 0.2, 48]} />
        <meshStandardMaterial color="#0e1530" metalness={0.8} roughness={0.25} flatShading />
      </mesh>
      <mesh position={[0, 0.205, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.42, 1.46, 64]} />
        <meshBasicMaterial color={ACCENT} toneMapped={false} />
      </mesh>
      <mesh position={[0, -0.005, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.7, 1.75, 0.05, 64]} />
        <meshStandardMaterial color="#070b1f" metalness={0.6} roughness={0.5} />
      </mesh>
      <AnimatedRings />
    </group>
  );
}

function AnimatedRings() {
  const ringRefs = useRef([]);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    ringRefs.current.forEach((r, i) => {
      if (!r) return;
      const speed = 0.25 + i * 0.08;
      r.rotation.z = (i % 2 === 0 ? t : -t) * speed;
    });
  });
  const rings = [
    { r: 1.3, arc: Math.PI * 1.6, opacity: 0.55 },
    { r: 1.05, arc: Math.PI * 1.4, opacity: 0.6 },
    { r: 0.78, arc: Math.PI * 1.7, opacity: 0.7 },
    { r: 0.5, arc: Math.PI * 1.3, opacity: 0.85 },
    { r: 0.25, arc: Math.PI * 2, opacity: 1.0 },
  ];
  return (
    <group position={[0, 0.21, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      {rings.map((ring, i) => (
        <mesh key={i} ref={(el) => (ringRefs.current[i] = el)}>
          <ringGeometry args={[ring.r - 0.014, ring.r, 64, 1, 0, ring.arc]} />
          <meshBasicMaterial color={ACCENT} transparent opacity={ring.opacity} toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
      ))}
      <mesh position={[0, 0, 0.001]}>
        <circleGeometry args={[0.08, 24]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </mesh>
    </group>
  );
}

/* ───────────────────────── Central Beam ───────────────────────── */
function CentralBeam() {
  return (
    <group>
      <mesh position={[0, 0.78, 0]}>
        <cylinderGeometry args={[0.006, 0.14, 1.2, 12, 1, true]} />
        <meshBasicMaterial color={ACCENT} transparent opacity={0.16} toneMapped={false} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.78, 0]}>
        <cylinderGeometry args={[0.004, 0.03, 1.2, 8]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.85} toneMapped={false} />
      </mesh>
    </group>
  );
}

/* ───────────────────────── Header ───────────────────────── */
function PortfolioHeader() {
  return (
    <group position={[0, 3.6, 0]}>
      <HexFrame width={1.92} height={0.42} color={ACCENT_DEEP} opacity={0.35} />
      <HexFrame width={1.8} height={0.32} color={ACCENT} lineWidth={2} />
      <SideAccentPanel position={[-1.27, 0, 0]} />
      <SideAccentPanel position={[1.27, 0, 0]} />
      <DashedConnector x1={-1.16} x2={-0.95} y={0} />
      <DashedConnector x1={0.95} x2={1.16} y={0} />
      <TickRow y={0.21} count={9} width={0.7} />
      <TickRow y={-0.21} count={9} width={0.7} />
      <Text
        position={[0, 0, 0.005]}
        fontSize={0.115}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.08}
        outlineWidth={0.005}
        outlineColor={ACCENT}
        outlineOpacity={0.4}
      >
        SELECTED WORK
      </Text>
    </group>
  );
}

function SideAccentPanel({ position }) {
  const ref = useRef();
  useFrame((state) => {
    if (!ref.current) return;
    ref.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 1.5) * 0.05);
  });
  return (
    <group position={position}>
      <HexFrame width={0.18} height={0.18} color={ACCENT} />
      <HexFrame width={0.24} height={0.24} color={ACCENT_DEEP} opacity={0.4} />
      <mesh ref={ref}>
        <circleGeometry args={[0.04, 16]} />
        <meshBasicMaterial color={ACCENT} transparent opacity={0.85} toneMapped={false} />
      </mesh>
      <mesh>
        <circleGeometry args={[0.015, 12]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </mesh>
    </group>
  );
}

function DashedConnector({ x1, x2, y }) {
  const dashes = 6;
  const gapToDash = 0.5;
  const total = x2 - x1;
  const dashLen = total / (dashes + (dashes - 1) * gapToDash);
  const gap = dashLen * gapToDash;
  const pts = [];
  for (let i = 0; i < dashes; i++) {
    pts.push(x1 + i * (dashLen + gap) + dashLen / 2);
  }
  return (
    <group>
      {pts.map((x, i) => (
        <mesh key={i} position={[x, y, 0]}>
          <planeGeometry args={[dashLen, 0.004]} />
          <meshBasicMaterial color={ACCENT} transparent opacity={0.55} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

function TickRow({ y, count, width }) {
  const spacing = width / (count - 1);
  return (
    <group position={[0, y, 0]}>
      {Array.from({ length: count }, (_, i) => (
        <mesh key={i} position={[-width / 2 + i * spacing, 0, 0]}>
          <planeGeometry args={[0.003, i % 2 === 0 ? 0.025 : 0.015]} />
          <meshBasicMaterial color={ACCENT} transparent opacity={0.6} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

// Octagonal frame (rectangle with notched corners) as a closed Line.
function HexFrame({ width, height, color = ACCENT, opacity = 1, lineWidth = 1.5 }) {
  const w = width / 2;
  const h = height / 2;
  const notch = Math.min(0.07, Math.min(w, h) * 0.18);
  const pts = [
    [-w + notch, h, 0],
    [w - notch, h, 0],
    [w, h - notch, 0],
    [w, -h + notch, 0],
    [w - notch, -h, 0],
    [-w + notch, -h, 0],
    [-w, -h + notch, 0],
    [-w, h - notch, 0],
    [-w + notch, h, 0],
  ];
  return <Line points={pts} color={color} lineWidth={lineWidth} transparent opacity={opacity} />;
}

// Tiny + marks at each corner of a panel.
function CornerTicks({ width, height }) {
  const w = width / 2;
  const h = height / 2;
  const size = 0.03;
  const corners = [
    [-w, h],
    [w, h],
    [-w, -h],
    [w, -h],
  ];
  return (
    <group position={[0, 0, 0.002]}>
      {corners.map(([cx, cy], i) => (
        <group key={i} position={[cx, cy, 0]}>
          <mesh>
            <planeGeometry args={[size * 2, 0.0028]} />
            <meshBasicMaterial color={ACCENT} transparent opacity={0.85} toneMapped={false} />
          </mesh>
          <mesh>
            <planeGeometry args={[0.0028, size * 2]} />
            <meshBasicMaterial color={ACCENT} transparent opacity={0.85} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ───────────────────────── Card visuals (right half) ───────────────────────── */
function CardVisual({ type, position }) {
  switch (type) {
    case 'cube':
      return <VisualCube position={position} />;
    case 'stack':
      return <VisualStack position={position} />;
    case 'transformer':
      return <VisualTransformer position={position} />;
    case 'screen':
    default:
      return <VisualScreen position={position} />;
  }
}

function VisualScreen({ position }) {
  const ref = useRef();
  useFrame((state) => {
    if (ref.current) ref.current.material.opacity = 0.55 + Math.sin(state.clock.elapsedTime * 2) * 0.1;
  });
  return (
    <group position={position}>
      <mesh>
        <planeGeometry args={[0.42, 0.32]} />
        <meshBasicMaterial color="#0a1230" toneMapped={false} />
      </mesh>
      <HexFrame width={0.42} height={0.32} color={ACCENT} opacity={0.9} />
      {[0.08, 0.02, -0.04, -0.1].map((y, i) => (
        <mesh key={i} position={[0, y, 0.001]}>
          <planeGeometry args={[0.32, 0.025]} />
          <meshBasicMaterial color={i === 0 ? ACCENT : '#1a2548'} transparent opacity={i === 0 ? 0.9 : 0.6} toneMapped={false} />
        </mesh>
      ))}
      <mesh ref={ref} position={[0, -0.12, 0.002]}>
        <planeGeometry args={[0.34, 0.015]} />
        <meshBasicMaterial color={ACCENT} transparent toneMapped={false} />
      </mesh>
    </group>
  );
}

function VisualCube({ position }) {
  const ref = useRef();
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    ref.current.rotation.y = t * 0.45;
    ref.current.rotation.x = Math.sin(t * 0.5) * 0.25;
  });
  return (
    <group position={position}>
      <mesh position={[0, -0.13, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.16, 0.19, 36]} />
        <meshBasicMaterial color={ACCENT} transparent opacity={0.45} toneMapped={false} />
      </mesh>
      <mesh position={[0, -0.13, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.11, 0.13, 36]} />
        <meshBasicMaterial color={ACCENT} transparent opacity={0.7} toneMapped={false} />
      </mesh>
      <group ref={ref} position={[0, 0.02, 0]}>
        <mesh>
          <boxGeometry args={[0.2, 0.2, 0.2]} />
          <meshBasicMaterial color="#7c3aed" transparent opacity={0.85} toneMapped={false} />
        </mesh>
        <mesh>
          <boxGeometry args={[0.21, 0.21, 0.21]} />
          <meshBasicMaterial color={ACCENT} wireframe toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

function VisualStack({ position }) {
  const ref = useRef();
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    const child = ref.current.children[0];
    if (child) child.material.emissiveIntensity = 0.6 + Math.sin(t * 2.5) * 0.25;
  });
  return (
    <group position={position} ref={ref}>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[0, 0.09 - i * 0.06, 0]} castShadow>
          <boxGeometry args={[0.36, 0.045, 0.18]} />
          <meshStandardMaterial
            color={i === 0 ? '#fbbf24' : '#1a2548'}
            emissive={i === 0 ? '#fbbf24' : '#000000'}
            emissiveIntensity={i === 0 ? 0.8 : 0}
            metalness={0.5}
            roughness={0.3}
          />
        </mesh>
      ))}
    </group>
  );
}

function VisualTransformer({ position }) {
  return (
    <group position={position}>
      {[0.09, 0.0, -0.09].map((y, i) => (
        <group key={i} position={[-0.08, y, 0]}>
          <mesh>
            <planeGeometry args={[0.21, 0.06]} />
            <meshBasicMaterial color="#1a2548" transparent opacity={0.85} toneMapped={false} />
          </mesh>
          <HexFrame width={0.21} height={0.06} color={ACCENT} opacity={0.9} />
          <Text fontSize={0.024} color={ACCENT} anchorX="center" anchorY="middle" position={[0, 0, 0.002]}>
            Transformer
          </Text>
        </group>
      ))}
      {[0.05, -0.05].map((y, i) => (
        <group key={i} position={[0.15, y, 0]}>
          <mesh>
            <planeGeometry args={[0.12, 0.05]} />
            <meshBasicMaterial color="#1a2548" transparent opacity={0.85} toneMapped={false} />
          </mesh>
          <HexFrame width={0.12} height={0.05} color={ACCENT} opacity={0.9} />
          <Text fontSize={0.022} color={ACCENT} anchorX="center" anchorY="middle" position={[0, 0, 0.002]}>
            {i === 0 ? 'Linear' : 'Softmax'}
          </Text>
        </group>
      ))}
    </group>
  );
}

/* ───────────────────────── Footer badges ───────────────────────── */
function FooterBadges() {
  const radius = 1.42;
  const yPos = 0.22;
  const arcSpread = 1.05;
  const offsets = [-1.5, -0.5, 0.5, 1.5].map((m) => m * (arcSpread / 3));
  return (
    <group>
      {FOOTER_BADGES.map((b, i) => {
        const angle = Math.PI / 2 + offsets[i];
        const x = radius * Math.cos(angle);
        const z = radius * Math.sin(angle);
        const yRot = angle - Math.PI / 2;
        return <FooterBadge key={b.label} position={[x, yPos, z]} rotationY={yRot} label={b.label} icon={b.icon} />;
      })}
    </group>
  );
}

function FooterBadge({ position, rotationY, label, icon }) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <BadgeIcon name={icon} position={[-0.18, 0, 0.001]} />
      <Text position={[-0.1, 0, 0.001]} fontSize={0.045} color={ACCENT} anchorX="left" anchorY="middle" letterSpacing={0.06}>
        {label}
      </Text>
    </group>
  );
}

function BadgeIcon({ name, position }) {
  switch (name) {
    case 'bulb':
      return (
        <group position={position}>
          <mesh>
            <circleGeometry args={[0.038, 16]} />
            <meshBasicMaterial color={ACCENT} transparent opacity={0.9} toneMapped={false} />
          </mesh>
          <mesh position={[0, -0.04, 0.001]}>
            <planeGeometry args={[0.04, 0.014]} />
            <meshBasicMaterial color={ACCENT} toneMapped={false} />
          </mesh>
        </group>
      );
    case 'code':
      return (
        <group position={position}>
          <Text fontSize={0.052} color={ACCENT} anchorX="center" anchorY="middle">
            {'</>'}
          </Text>
        </group>
      );
    case 'palette':
      return (
        <group position={position}>
          <mesh rotation={[0, 0, Math.PI / 4]}>
            <planeGeometry args={[0.055, 0.055]} />
            <meshBasicMaterial color={ACCENT} transparent opacity={0.85} toneMapped={false} />
          </mesh>
          <mesh rotation={[0, 0, Math.PI / 4]} position={[0, 0, 0.001]}>
            <planeGeometry args={[0.03, 0.03]} />
            <meshBasicMaterial color="#070b1f" toneMapped={false} />
          </mesh>
        </group>
      );
    case 'globe':
    default:
      return (
        <group position={position}>
          <mesh>
            <ringGeometry args={[0.032, 0.04, 24]} />
            <meshBasicMaterial color={ACCENT} toneMapped={false} />
          </mesh>
          <mesh>
            <ringGeometry args={[0.012, 0.018, 16]} />
            <meshBasicMaterial color={ACCENT} toneMapped={false} />
          </mesh>
        </group>
      );
  }
}
