import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, Line } from '@react-three/drei';
import * as THREE from 'three';
import { useJourney } from '../state/useJourney.js';

// EducationBook — a glowing holographic "tome" that hovers over the UTAS
// rooftop. It's still a real book (covers, pages, a 180° page-turn on
// click), but rendered for the neon diorama: dark glass covers with cyan
// edge-glow, luminous gilded pages, a soft aura, rotating halo rings and a
// gentle levitation bob. Each spread is one school achievement.
//
// Rooftop height is read from the building GLB's bounding box, so the book
// seats itself on top at any model scale. Fine-tune placement with
// `book.offset` / `book.scale` / `book.rotation` in src/data/stations.js.

const CW = 512; // page canvas width
const CH = 720; // page canvas height (portrait)

const CYAN = '#7fe3ff'; // structural neon (edges, rings, aura)
const CYAN_DEEP = '#39b6e6';
const GOLD = '#e3c178'; // award / content accent
const GOLD_DEEP = '#b9923f';
const INK = '#fff7e6';
const INK_DIM = '#d3cbb0';

// Book geometry in local units (before book.scale).
const HPW = 0.56; // half-page width (one page)
const PGH = 0.78; // page height
const FLIP_DURATION = 0.7; // seconds per page turn

export default function EducationBook({ station }) {
  const book = station.book;
  const { scene } = useGLTF(station.model);
  const currentIndex = useJourney((s) => s.currentIndex);
  const viewMode = useJourney((s) => s.viewMode);
  const interactive = viewMode === 'tour' && currentIndex === station.index - 1;

  const achievements = book?.achievements?.length ? book.achievements : FALLBACK_ACH;
  const N = achievements.length;

  // Roof height from the building's bounding box × its Y scale.
  const roofY = useMemo(() => {
    const bbox = new THREE.Box3().setFromObject(scene);
    const sY = Array.isArray(station.modelScale) ? station.modelScale[1] : station.modelScale ?? 1;
    const h = (Number.isFinite(bbox.max.y) ? bbox.max.y : 0) * sY;
    return 0.06 + h;
  }, [scene, station.modelScale]);

  // One CanvasTexture per page face, built once.
  const { leftTex, rightTex } = useMemo(() => {
    const left = achievements.map((a, i) => makePageTexture('left', a, i, N, book));
    const right = achievements.map((a, i) => makePageTexture('right', a, i, N, book));
    return { leftTex: left, rightTex: right };
  }, [achievements, N, book]);

  const offset = book?.offset ?? [0, 0.5, 0];
  const scale = book?.scale ?? 2.0;
  const rotation = book?.rotation ?? [-0.55, 0, 0];

  // --- Page-turn state ---
  const [spread, setSpread] = useState(0);
  const [flipping, setFlipping] = useState(false);
  const flip = useRef({ active: false, startedAt: null });
  const turnRef = useRef();
  const bobRef = useRef();
  const reveal = useRef(0); // 0 = hidden (overview), 1 = shown (tour, focused)
  const next = (spread + 1) % N;

  const startFlip = () => {
    if (!interactive || flip.current.active || N < 2) return;
    flip.current = { active: true, startedAt: null };
    setFlipping(true);
  };

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;

    // Materialize only in Tour while this station is focused; stay hidden
    // (and unclickable) in Overview.
    const target = interactive ? 1 : 0;
    const k = 1 - Math.exp(-7 * Math.min(delta, 0.1));
    reveal.current += (target - reveal.current) * k;

    // Levitation bob + faint sway, scaled by the reveal so it eases in/out.
    if (bobRef.current) {
      bobRef.current.visible = reveal.current > 0.02;
      bobRef.current.scale.setScalar(reveal.current);
      bobRef.current.position.y = Math.sin(t * 1.1) * 0.04;
      bobRef.current.rotation.z = Math.sin(t * 0.7) * 0.015;
    }

    // Page turn.
    if (turnRef.current) {
      if (flip.current.active) {
        if (flip.current.startedAt === null) flip.current.startedAt = t;
        const p = Math.min(1, (t - flip.current.startedAt) / FLIP_DURATION);
        const eased = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        turnRef.current.visible = true;
        turnRef.current.rotation.y = -Math.PI * eased;
        if (p >= 1) {
          flip.current.active = false;
          turnRef.current.visible = false;
          turnRef.current.rotation.y = 0;
          setSpread((s) => (s + 1) % N);
          setFlipping(false);
        }
      } else {
        turnRef.current.visible = false;
      }
    }
  });

  const leftFace = leftTex[spread];
  const rightFace = flipping ? rightTex[next] : rightTex[spread];
  const turnFront = rightTex[spread];
  const turnBack = leftTex[next];

  return (
    <group position={[offset[0], roofY + offset[1], offset[2]]} rotation={rotation} scale={scale}>
      <group ref={bobRef} scale={0.001}>
        {/* Invisible click target */}
        <mesh
          position={[0, 0, 0.06]}
          onClick={(e) => {
            if (!interactive) return;
            e.stopPropagation();
            startFlip();
          }}
          onPointerOver={(e) => {
            if (!interactive) return;
            e.stopPropagation();
            document.body.style.cursor = 'pointer';
          }}
          onPointerOut={() => {
            if (interactive) document.body.style.cursor = 'default';
          }}
        >
          <planeGeometry args={[HPW * 2 + 0.16, PGH + 0.16]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>

        <BookBody />

        {/* Static pages + glowing borders */}
        <PagePlane texture={leftFace} center={[-HPW / 2, 0, 0.012]} />
        <PagePlane texture={rightFace} center={[HPW / 2, 0, 0.012]} />

        {/* Turning page */}
        <group ref={turnRef} visible={false}>
          <PagePlane texture={turnFront} center={[HPW / 2, 0, 0.022]} />
          <PagePlane texture={turnBack} center={[HPW / 2, 0, 0.02]} rotationY={Math.PI} />
        </group>
      </group>
    </group>
  );
}

/* ───────────────────────── A single page plane + glow border ───────────────────────── */
function PagePlane({ texture, center, rotationY = 0 }) {
  return (
    <group position={center} rotation={[0, rotationY, 0]}>
      <mesh>
        <planeGeometry args={[HPW, PGH]} />
        <meshBasicMaterial map={texture} toneMapped={false} side={THREE.FrontSide} transparent />
      </mesh>
      <PageBorder />
    </group>
  );
}

function PageBorder() {
  const w = HPW / 2 - 0.01;
  const h = PGH / 2 - 0.01;
  const pts = [
    [-w, h, 0.001],
    [w, h, 0.001],
    [w, -h, 0.001],
    [-w, -h, 0.001],
    [-w, h, 0.001],
  ];
  return <Line points={pts} color={CYAN} lineWidth={1.4} transparent opacity={0.7} />;
}

/* ───────────────────────── Book body (glass covers + neon edges) ───────────────────────── */
function BookBody() {
  const coverW = HPW * 2 + 0.09;
  const coverH = PGH + 0.08;
  const ew = coverW / 2;
  const eh = coverH / 2;
  const framePts = [
    [-ew, eh, 0],
    [ew, eh, 0],
    [ew, -eh, 0],
    [-ew, -eh, 0],
    [-ew, eh, 0],
  ];
  return (
    <group>
      {/* Dark glass cover board */}
      <mesh position={[0, 0, -0.025]} castShadow receiveShadow>
        <boxGeometry args={[coverW, coverH, 0.05]} />
        <meshStandardMaterial color="#070c1c" roughness={0.3} metalness={0.6} emissive={CYAN_DEEP} emissiveIntensity={0.06} />
      </mesh>
      {/* Neon edge frame on the cover */}
      <group position={[0, 0, 0.004]}>
        <Line points={framePts} color={CYAN} lineWidth={2.2} transparent opacity={0.9} />
      </group>

      {/* Page-stack thickness rendered as glowing striations (not cream) */}
      {[-1, 1].map((side) => (
        <group key={side} position={[(side * HPW) / 2, 0, 0.0]}>
          <mesh position={[0, 0, 0.001]}>
            <boxGeometry args={[HPW + 0.02, PGH + 0.012, 0.035]} />
            <meshStandardMaterial color="#0c1430" roughness={0.5} metalness={0.4} emissive={CYAN_DEEP} emissiveIntensity={0.05} />
          </mesh>
        </group>
      ))}

      {/* Spine glow */}
      <mesh position={[0, 0, 0.026]}>
        <planeGeometry args={[0.016, PGH]} />
        <meshBasicMaterial color={GOLD} transparent opacity={0.8} toneMapped={false} />
      </mesh>
      {/* Outer corner accents (gold) */}
      {[[-ew, eh], [ew, eh], [-ew, -eh], [ew, -eh]].map(([x, y], i) => (
        <mesh key={i} position={[x, y, 0.006]}>
          <circleGeometry args={[0.018, 16]} />
          <meshBasicMaterial color={GOLD} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

/* ───────────────────────── Page texture drawing ───────────────────────── */
function makePageTexture(kind, achievement, index, total, book) {
  const canvas = document.createElement('canvas');
  canvas.width = CW;
  canvas.height = CH;
  const ctx = canvas.getContext('2d');
  if (kind === 'left') drawLeftPage(ctx, achievement, index, total, book);
  else drawRightPage(ctx, achievement, index, total, book);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 4;
  return tex;
}

function pageBase(ctx) {
  // Deep holographic glass page with a cyan inner glow + gold frame.
  ctx.fillStyle = '#0a1228';
  ctx.fillRect(0, 0, CW, CH);
  const glow = ctx.createRadialGradient(CW / 2, CH * 0.42, 30, CW / 2, CH * 0.5, CH * 0.7);
  glow.addColorStop(0, 'rgba(57,182,230,0.18)');
  glow.addColorStop(1, 'rgba(10,18,40,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, CW, CH);
  // Gold double frame
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2.5;
  roundRectPath(ctx, 34, 34, CW - 68, CH - 68, 12);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(127,227,255,0.4)';
  ctx.lineWidth = 1;
  roundRectPath(ctx, 44, 44, CW - 88, CH - 88, 9);
  ctx.stroke();
}

function pageHeader(ctx, text) {
  ctx.save();
  ctx.shadowColor = GOLD;
  ctx.shadowBlur = 12;
  ctx.fillStyle = GOLD;
  ctx.font = '600 23px Georgia, "Times New Roman", serif';
  ctx.textAlign = 'center';
  ctx.fillText(text.toUpperCase(), CW / 2, 96);
  ctx.restore();
  ctx.strokeStyle = 'rgba(227,193,120,0.6)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(88, 116);
  ctx.lineTo(CW - 88, 116);
  ctx.stroke();
}

function pageNumber(ctx, n) {
  ctx.fillStyle = INK_DIM;
  ctx.font = 'italic 20px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText(`— ${n} —`, CW / 2, CH - 58);
}

function drawLeftPage(ctx, a, index, total, book) {
  pageBase(ctx);
  pageHeader(ctx, book?.school ?? 'University');
  drawCrest(ctx, CW / 2, 248, 80);

  ctx.save();
  ctx.shadowColor = 'rgba(127,227,255,0.5)';
  ctx.shadowBlur = 10;
  ctx.fillStyle = INK;
  ctx.font = '700 42px Georgia, serif';
  ctx.textAlign = 'center';
  wrapText(ctx, a.title ?? '', CW / 2, 424, CW - 120, 48);
  ctx.restore();

  if (a.year) {
    const label = String(a.year);
    ctx.font = '600 25px Georgia, serif';
    const w = ctx.measureText(label).width + 60;
    const x = CW / 2 - w / 2;
    const y = 524;
    ctx.fillStyle = 'rgba(227,193,120,0.14)';
    roundRectPath(ctx, x, y, w, 52, 26);
    ctx.fill();
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 2;
    roundRectPath(ctx, x, y, w, 52, 26);
    ctx.stroke();
    ctx.fillStyle = GOLD;
    ctx.textAlign = 'center';
    ctx.fillText(label, CW / 2, y + 35);
  }
  pageNumber(ctx, index * 2 + 1);
}

function drawRightPage(ctx, a, index, total, book) {
  pageBase(ctx);
  pageHeader(ctx, a.tag ?? 'Highlight');
  drawMedal(ctx, CW / 2, 192, 36);

  ctx.textAlign = 'left';
  const x = 72;
  let y = 296;
  (a.lines ?? []).slice(0, 5).forEach((line) => {
    ctx.fillStyle = GOLD;
    ctx.beginPath();
    ctx.arc(x + 4, y - 8, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = INK_DIM;
    ctx.font = '400 26px Georgia, serif';
    y = wrapText(ctx, line, x + 24, y, CW - x - 70, 38) + 24;
  });

  ctx.fillStyle = 'rgba(127,227,255,0.9)';
  ctx.font = 'italic 22px Georgia, serif';
  ctx.textAlign = 'right';
  ctx.fillText('turn the page  ›', CW - 70, CH - 108);
  pageNumber(ctx, index * 2 + 2);
}

function drawCrest(ctx, cx, cy, r) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.shadowColor = GOLD;
  ctx.shadowBlur = 12;
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, r, Math.PI * 0.15, Math.PI * 0.85);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, r, Math.PI * 1.15, Math.PI * 1.85);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(127,227,255,0.55)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, r - 12, 0, Math.PI * 2);
  ctx.stroke();
  drawStar(ctx, 0, 0, 5, r * 0.5, r * 0.22, GOLD);
  ctx.restore();
}

function drawMedal(ctx, cx, cy, r) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = GOLD_DEEP;
  ctx.beginPath();
  ctx.moveTo(-12, r * 0.4);
  ctx.lineTo(-22, r + 24);
  ctx.lineTo(0, r + 6);
  ctx.lineTo(22, r + 24);
  ctx.lineTo(12, r * 0.4);
  ctx.closePath();
  ctx.fill();
  ctx.shadowColor = GOLD;
  ctx.shadowBlur = 14;
  ctx.fillStyle = 'rgba(227,193,120,0.18)';
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 3;
  ctx.stroke();
  drawStar(ctx, 0, 0, 5, r * 0.6, r * 0.28, GOLD);
  ctx.restore();
}

function drawStar(ctx, cx, cy, spikes, outerR, innerR, color) {
  let rot = (Math.PI / 2) * 3;
  const step = Math.PI / spikes;
  ctx.beginPath();
  ctx.moveTo(cx, cy - outerR);
  for (let i = 0; i < spikes; i++) {
    let x = cx + Math.cos(rot) * outerR;
    let y = cy + Math.sin(rot) * outerR;
    ctx.lineTo(x, y);
    rot += step;
    x = cx + Math.cos(rot) * innerR;
    y = cy + Math.sin(rot) * innerR;
    ctx.lineTo(x, y);
    rot += step;
  }
  ctx.lineTo(cx, cy - outerR);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = String(text).split(/\s+/);
  let line = '';
  let yy = y;
  for (let i = 0; i < words.length; i++) {
    const test = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, yy);
      line = words[i];
      yy += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, yy);
  return yy;
}

function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

const FALLBACK_ACH = [
  { title: 'Add your achievement', year: '20XX', lines: ['Edit book.achievements in src/data/stations.js'] },
];
