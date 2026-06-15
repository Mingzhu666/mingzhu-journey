import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { useJourney } from '../state/useJourney.js';
import { useDeviceProfile } from '../state/useDeviceProfile.js';
import { shouldActivateArrivalEffects, shouldShowWelcomeContent } from './stationVisuals.js';

// Welcome station — the monitor is a tiny, real terminal.
//
//   • A blinking prompt shows what the visitor is typing.
//   • Typing a command + Enter (whoami / impact / coverage / volunteer / help)
//     "runs" it; the matching hero number then counts up on screen.
//   • The same commands are clickable chips along the bottom, so visitors
//     who don't realise they can type — or are on a touch device — can just
//     tap. Chip clicks are hit-tested against the 3D screen via its UVs.
//
// Keystrokes are captured in the HTML Overlay (it owns the window keydown
// listener) and flow through the journey store; this component only reads
// that state and paints it onto a CanvasTexture. The screen overlay is
// positioned in model-local space via `station.screen` in stations.js.

const DEFAULT_PERSONA = {
  label: 'Full-stack Engineer',
  cmd: 'whoami',
  file: 'whoami.ts',
  metric: 6,
  suffix: '+ yrs',
  headline: 'full-stack engineering',
  sub: 'Vue · TypeScript · React/Next · Java · Go',
};

// Commands shown as chips (and accepted by `help`). Order = chip order.
const COMMANDS = [
  { cmd: 'whoami', desc: 'who I am & my stack' },
  { cmd: 'impact', desc: 'delivery & productivity gains' },
  { cmd: 'coverage', desc: 'testing & reliability' },
  { cmd: 'volunteer', desc: 'volunteering & teaching' },
  { cmd: 'help', desc: 'list commands' },
];

// How long (seconds) the hero number spends counting up before it holds.
const COUNTUP_DURATION = 0.9;

// Keep the welcome monitor fully black for a blink after the loading cover
// disappears, so the first visible state is unmistakably "off" before it
// boots into the intro content.
const BOOT_BLACK_HOLD = 0.28;

// Canvas resolution (LOGICAL). All drawing + UV hit-testing use these
// coordinates. Higher = sharper but slower to redraw.
const CANVAS_W = 768;
const CANVAS_H = 480;

// Supersample factor: the backing canvas is rendered at SS× the logical
// resolution so the terminal stays crisp once it grows into the big "focus"
// panel in tour view. We pre-scale the 2D context by SS, so every draw call
// (and the chip rectangles used for clicks) still works in logical pixels.
const SS = 2;

// Tour "focus" presentation. When the camera parks at the welcome station,
// the WHOLE monitor (bezel + screen) eases up into one big head-on display —
// it scales as a single cohesive object, pivoting around the screen so the
// display stays centered while the chassis grows to fill (and spill past) the
// frame, like sitting right up to a large monitor. All targets below were
// tuned numerically against the tour camera (see dev notes): the display
// lands centered, ~0.72×0.64 of the frame on 16:9, never clips the screen
// across 16:9/16:10/3:2/4:3/21:9, and the command chips stay clear of the car.
const FOCUS_SCALE = 2.6; // how much bigger the whole monitor gets
const FOCUS_WIDEN = 1.18; // extra horizontal stretch (wider display)
const FOCUS_ANCHOR = [0, 2.0, 0.25]; // where the screen center lands (OUTER-local)
// Pitch the screen back so its face aims at the raised tour camera (~14° above).
// This must be applied as a CLEAN Ry(−tiltY)·Rx(pitch) quaternion: the parent
// group carries a +tiltY row-tilt, and only that exact order cancels it without
// leaving a residual roll (which read as the screen looking "crooked").
const FOCUS_PITCH_X = -0.22; // ≈13° back-tilt, head-on to the camera, zero roll

// Scratch objects reused every frame so the focus animation allocates nothing.
const _q = new THREE.Quaternion();
const _qx = new THREE.Quaternion();
const _qy = new THREE.Quaternion();
const _xAxis = new THREE.Vector3(1, 0, 0);
const _yAxis = new THREE.Vector3(0, 1, 0);
const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _zero = new THREE.Vector3(0, 0, 0);
const lerp = (a, b, t) => a + (b - a) * t;

// Palette.
const ACCENT = '#6ee7ff';
const GREEN = '#34d399';
const DIM = '#7681b4';
const BRIGHT = '#eafcff';

export default function WelcomeMonitor({ station }) {
  const { scene } = useGLTF(station.model);
  const buildingGlow = station.buildingGlow !== false;
  const currentIndex = useJourney((s) => s.currentIndex);
  const viewMode = useJourney((s) => s.viewMode);
  const isDriving = useJourney((s) => s.isDriving);
  const sceneReady = useJourney((s) => s.sceneReady);
  const welcomeRun = useJourney((s) => s.welcomeRun);
  const welcomeReset = useJourney((s) => s.welcomeReset);
  const arrivalActive = shouldActivateArrivalEffects({ station, currentIndex, isDriving });
  const contentActive = shouldShowWelcomeContent({
    station,
    currentIndex,
    isDriving,
    sceneReady,
  });
  // "Parked & focused": tour mode, sitting AT the welcome station, engine off.
  // This is when the screen grows into the big panel and accepts commands.
  const interactive =
    viewMode === 'tour' && arrivalActive;
  const personas = station.personas?.length ? station.personas : [DEFAULT_PERSONA];

  // Every time the visitor parks at the welcome station, wipe any previous
  // command result so it always opens on the full intro — no remembered state.
  useEffect(() => {
    if (interactive) welcomeReset();
  }, [interactive, welcomeReset]);

  const cloned = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((obj) => {
      if (obj.isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
        const liftMaterial = (material) => {
          if (!material) return material;
          const next = material.clone();
          if (next.color) {
            next.color.multiplyScalar(buildingGlow ? 0.62 : 0.72);
            if (buildingGlow) {
              next.color.lerp(new THREE.Color('#dbeafe'), 0.06);
            }
          }
          if ('roughness' in next) next.roughness = buildingGlow
            ? Math.min(next.roughness ?? 0.7, 0.58)
            : Math.max(next.roughness ?? 0.7, 0.7);
          if ('metalness' in next) next.metalness = buildingGlow
            ? Math.max(next.metalness ?? 0.25, 0.38)
            : next.metalness ?? 0.25;
          if ('emissive' in next) {
            if (buildingGlow) {
              next.emissive = new THREE.Color(station.color);
              next.emissiveIntensity = Math.max(next.emissiveIntensity ?? 0, 0.025);
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
  }, [scene, station.color, buildingGlow]);

  // Static tilt for visual layering across the diorama row.
  const tiltY = station.tiltY ?? 0;
  const baseLift = 0.06;
  const offset = station.modelOffset ?? [0, 0, 0];
  const position = [offset[0], offset[1], offset[2]];
  const rotation = station.modelRotation ?? [0, 0, 0];
  const scale = station.modelScale ?? 1;

  const screenCfg = station.screen ?? {
    position: [0, 0.55, 0.08],
    rotation: [0, 0, 0],
    size: [0.95, 0.6],
  };

  // The "focus" group wraps the whole monitor and scales it about the screen.
  // It's identity (== original look) when docked, and eases to the big-display
  // pose when parked at the station. See useFrame below.
  const focusRef = useRef(null);
  const focusAmt = useRef(interactive ? 1 : 0);

  // Screen-center pivot, expressed in this group's local space (after the
  // model's own scale/offset). Scaling about this point keeps the display put.
  const pivot = useMemo(
    () => [
      position[0] + scale * screenCfg.position[0],
      position[1] + scale * screenCfg.position[1],
      position[2] + scale * screenCfg.position[2],
    ],
    [position, scale, screenCfg.position],
  );

  useFrame((state, delta) => {
    const target = interactive ? 1 : 0;
    const k = 1 - Math.exp(-5 * Math.min(delta || 0.016, 0.1));
    focusAmt.current += (target - focusAmt.current) * k;
    const f = focusAmt.current;
    const g = focusRef.current;
    if (!g) return;

    // Interpolate the pose: anchor (where the screen lands), rotation (cancel
    // the row tilt + a small backward lean) and scale (with horizontal widen).
    const ax = lerp(pivot[0], FOCUS_ANCHOR[0], f);
    const ay = lerp(pivot[1], FOCUS_ANCHOR[1], f);
    const az = lerp(pivot[2], FOCUS_ANCHOR[2], f);
    // Portrait fit: the focus panel is sized for a landscape 16:9 frame, so on a
    // tall phone it blows up wider than the screen and the terminal text gets
    // cropped left/right. As the viewport gets more portrait, shrink the blow-up
    // and drop the extra horizontal widening so the whole monitor lands inside a
    // narrow screen. Landscape (aspect >= 1.3) keeps the original desktop values.
    //
    // Portrait end values are sized against the tour camera's portrait
    // pull-back (getTourCameraFrame): at a 390×844 phone the camera frames
    // ~4.5 world units of width at the welcome station, so the screen
    // (2.58 wide × scale) must stay under that — 1.7 × no-widen lands at
    // ~4.4 with a small margin. (2.0 × 0.92 = 4.75 overflowed and cropped.)
    const aspect = state.size.width / Math.max(1, state.size.height);
    const pk = Math.max(0, Math.min(1, (aspect - 0.5) / (1.3 - 0.5)));
    const focusScale = lerp(1.7, FOCUS_SCALE, pk);
    const focusWiden = lerp(1.0, FOCUS_WIDEN, pk);
    const sx = lerp(1, focusScale * focusWiden, f);
    const sy = lerp(1, focusScale, f);
    // q = Ry(−tiltY)·Rx(pitch): cancels the parent's +tiltY first, then pitches
    // back — keeping the top edge perfectly level (no roll) at any blend amount.
    _qx.setFromAxisAngle(_xAxis, FOCUS_PITCH_X * f);
    _qy.setFromAxisAngle(_yAxis, -tiltY * f);
    _q.copy(_qy).multiply(_qx);
    _m.compose(_zero, _q, _p.set(sx, sy, sy));
    // position = anchor − (R·S)·pivot, so the transform pivots about the screen.
    const rsp = _p.set(pivot[0], pivot[1], pivot[2]).applyMatrix4(_m);
    g.position.set(ax - rsp.x, ay - rsp.y, az - rsp.z);
    g.quaternion.copy(_q);
    g.scale.set(sx, sy, sy);
  });

  return (
    <group position={[0, baseLift, 0]} rotation={[0, tiltY, 0]}>
      <group ref={focusRef}>
        <group position={position} rotation={rotation} scale={scale}>
          <primitive object={cloned} />
          <ScreenTerminal
            position={screenCfg.position}
            rotation={screenCfg.rotation}
            size={screenCfg.size}
            personas={personas}
            contentActive={contentActive}
            interactive={interactive}
            onRunCommand={welcomeRun}
          />
        </group>
      </group>
    </group>
  );
}

/* --------------- Live terminal screen --------------- */
// The screen plane stays at its fixed spot on the monitor face; the parent
// "focus" group is what scales the whole monitor up in tour view. The canvas
// is supersampled (SS) so the texture stays crisp once it's blown up large.
function ScreenTerminal({ position, rotation, size, personas, contentActive, interactive, onRunCommand }) {
  const { isTouch } = useDeviceProfile();
  const welcomeInput = useJourney((s) => s.welcomeInput);
  const welcomeMode = useJourney((s) => s.welcomeMode);
  const welcomeError = useJourney((s) => s.welcomeError);
  const activeWelcomePersona = useJourney((s) => s.activeWelcomePersona);
  const welcomeRunSeq = useJourney((s) => s.welcomeRunSeq);
  const welcomeRunCmd = useJourney((s) => s.welcomeRunCmd);

  const canvas = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = CANVAS_W * SS;
    c.height = CANVAS_H * SS;
    return c;
  }, []);

  const texture = useMemo(() => {
    const t = new THREE.CanvasTexture(canvas);
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [canvas]);

  // Layout of the clickable chips, recomputed each draw and stored so the
  // pointer handlers can hit-test against the same rectangles.
  const chipRectsRef = useRef([]);
  const hoveredChipRef = useRef(-1);

  // Portrait viewports draw the chips bigger (taller, larger type) — on a
  // phone the focus panel is only ~390 CSS px wide, so the desktop chip row
  // renders ~20 px tall: half of a comfortable touch target. Tracked as a
  // ref + repaint key so the layout swaps the moment orientation changes.
  const bigChipsRef = useRef(false);

  // Count-up timing is anchored to the moment a command runs (not the global
  // clock) so every run replays the animation from zero.
  const runStartRef = useRef(0);
  const lastSeqRef = useRef(welcomeRunSeq);
  const revealRef = useRef(0);
  const contentActiveAtRef = useRef(null);
  const lastContentActiveRef = useRef(contentActive);

  const persona = personas[activeWelcomePersona % personas.length] ?? DEFAULT_PERSONA;

  const paint = (sinceRun, cursorOn, borderPulse, reveal) => {
    const ctx = canvas.getContext('2d');
    // Render at SS× density but keep drawing in logical pixels.
    ctx.setTransform(SS, 0, 0, SS, 0, 0);
    const state = {
      mode: welcomeMode,
      input: welcomeInput,
      error: welcomeError,
      persona,
      contentActive,
      reveal,
      interactive,
      sinceRun,
      cursorOn,
      borderPulse,
      hoveredChip: hoveredChipRef.current,
      bigChips: bigChipsRef.current,
      // The chip that lights up as "active". Follow the command that actually
      // ran (so tapping `help` highlights HELP — it isn't a persona, and the
      // old persona-based highlight stayed stuck on whoami, which read as
      // "my tap didn't land on help"). Fall back to the active persona's chip
      // for the initial idle screen.
      activeCmd: welcomeRunCmd ?? persona?.cmd,
    };
    chipRectsRef.current = drawTerminal(ctx, CANVAS_W, CANVAS_H, state);
    texture.needsUpdate = true;
  };

  // Initial paint so we never flash a blank texture.
  useEffect(() => {
    paint(99, true, 0, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvas, texture]);

  const lastKey = useRef('');

  useFrame((stateR3F, delta) => {
    const elapsed = stateR3F.clock.elapsedTime;
    const k = 1 - Math.exp(-2.6 * Math.min(delta || 0.016, 0.1));
    if (contentActive !== lastContentActiveRef.current) {
      lastContentActiveRef.current = contentActive;
      contentActiveAtRef.current = contentActive ? elapsed : null;
    } else if (contentActive && contentActiveAtRef.current == null) {
      contentActiveAtRef.current = elapsed;
    }

    const bootAge = contentActiveAtRef.current == null
      ? 0
      : elapsed - contentActiveAtRef.current;
    const revealTarget = contentActive && bootAge >= BOOT_BLACK_HOLD ? 1 : 0;
    revealRef.current += (revealTarget - revealRef.current) * k;

    // Portrait (and square-ish) viewports get the big-chip layout.
    bigChipsRef.current =
      stateR3F.size.width / Math.max(1, stateR3F.size.height) < 1.05;

    // Reset the count-up clock whenever a new command runs.
    if (welcomeRunSeq !== lastSeqRef.current) {
      lastSeqRef.current = welcomeRunSeq;
      runStartRef.current = elapsed;
    }
    const sinceRun = elapsed - runStartRef.current;

    const cursorOn = Math.floor(elapsed * 1.6) % 2 === 0;
    const countStep = Math.floor(Math.min(1, sinceRun / COUNTUP_DURATION) * 30);
    const borderPulse = interactive ? Math.floor(elapsed * 4) : 0;
    const revealStep = Math.floor(revealRef.current * 40);

    const key = [
      interactive ? 'i' : 'o',
      contentActive ? 'on' : 'off',
      revealStep,
      welcomeMode,
      welcomeRunSeq,
      activeWelcomePersona,
      welcomeInput,
      welcomeError ?? '',
      cursorOn ? 1 : 0,
      countStep,
      hoveredChipRef.current,
      borderPulse,
      bigChipsRef.current ? 'b' : 's',
    ].join('|');

    if (key !== lastKey.current) {
      lastKey.current = key;
      paint(sinceRun, cursorOn, borderPulse, revealRef.current);
    }
  });

  // --- Pointer → canvas-space mapping for chip hit-testing ---
  // Forgiving by design: an exact rectangle test made taps "miss" on phones —
  // a fingertip's reported point easily lands 10–25 px (in canvas space)
  // outside the drawn chip, so visitors tapped `help` and nothing (or a
  // neighbour) fired. Instead, accept any tap within a slop margin of a chip
  // and resolve to the NEAREST chip, so a tap that visually lands on a chip
  // always runs that chip. Direct hits have distance 0 and always win.
  const uvToChip = (uv) => {
    if (!uv) return -1;
    const cx = uv.x * CANVAS_W;
    const cy = (1 - uv.y) * CANVAS_H;
    const slopX = isTouch ? 14 : 6;
    const slopY = isTouch ? 26 : 10;
    let best = -1;
    let bestD = Infinity;
    chipRectsRef.current.forEach((r, i) => {
      const dx = Math.max(r.x - cx, cx - (r.x + r.w), 0);
      const dy = Math.max(r.y - cy, cy - (r.y + r.h), 0);
      if (dx > slopX || dy > slopY) return;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  };

  return (
    <mesh
      position={position}
      rotation={rotation}
      onClick={(e) => {
        if (!interactive) return;
        const hit = uvToChip(e.uv);
        if (hit >= 0) {
          e.stopPropagation();
          onRunCommand(chipRectsRef.current[hit].cmd);
        }
      }}
      onPointerMove={(e) => {
        if (!interactive) return;
        const hit = uvToChip(e.uv);
        hoveredChipRef.current = hit;
        document.body.style.cursor = hit >= 0 ? 'pointer' : 'default';
      }}
      onPointerOut={() => {
        hoveredChipRef.current = -1;
        if (interactive) document.body.style.cursor = 'default';
      }}
    >
      <planeGeometry args={size} />
      <meshBasicMaterial map={texture} toneMapped={false} side={THREE.DoubleSide} />
    </mesh>
  );
}

/* =================== Drawing =================== */
// Returns the chip rectangles (with their `cmd`) so the caller can hit-test.
// W/H are LOGICAL dimensions (the context is already scaled by SS), so the
// returned rectangles are in the same logical space the UV hit-test uses.
function drawTerminal(ctx, W, H, s) {
  const reveal = Math.max(0, Math.min(1, s.reveal ?? (s.contentActive ? 1 : 0)));
  if (!s.contentActive && reveal <= 0.01) {
    drawOffScreen(ctx, W, H);
    return [];
  }

  drawBackground(ctx, W, H);
  drawChrome(ctx, W, s.persona?.file ?? 'whoami.ts');

  // Body region (between chrome and the prompt) holds the output.
  if (!s.interactive) {
    drawIdleBanner(ctx, W, H, true);
  } else if (s.mode === 'result') {
    drawResult(ctx, W, H, s.persona, s.sinceRun);
  } else if (s.mode === 'help') {
    drawHelp(ctx, W, H);
  } else if (s.mode === 'error') {
    drawError(ctx, W, H, s.error);
  } else {
    drawIdleBanner(ctx, W, H, false);
  }

  // Prompt line — always present so the screen always reads as a terminal.
  const big = s.interactive && s.bigChips;
  drawPrompt(ctx, W, H, s.input, s.cursorOn, s.interactive, big);

  // Command chips (only interactive; they are the click targets).
  let chips = [];
  if (s.interactive) {
    chips = drawChips(ctx, W, H, s.activeCmd, s.hoveredChip, big);
    drawHint(ctx, W, H, s.borderPulse, big);
  }

  drawBorder(ctx, W, H, s.borderPulse, s.interactive);
  drawScanlines(ctx, W, H);
  drawBootFade(ctx, W, H, reveal);
  return chips;
}

function drawOffScreen(ctx, W, H) {
  ctx.fillStyle = '#01030a';
  ctx.fillRect(0, 0, W, H);

  // A barely visible glass reflection keeps the monitor surface from reading
  // as a missing texture while still staying visually black.
  const sheen = ctx.createLinearGradient(0, 0, W, H);
  sheen.addColorStop(0, 'rgba(255,255,255,0.035)');
  sheen.addColorStop(0.24, 'rgba(255,255,255,0)');
  sheen.addColorStop(1, 'rgba(110,231,255,0.018)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, W, H);
}

function drawBootFade(ctx, W, H, reveal) {
  const alpha = Math.max(0, Math.min(1, 1 - reveal));
  if (alpha <= 0.002) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  drawOffScreen(ctx, W, H);
  ctx.restore();
}

function drawBackground(ctx, W, H) {
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0d1428');
  bg.addColorStop(1, '#05081a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
}

function drawChrome(ctx, W, title) {
  ctx.fillStyle = '#11163a';
  ctx.fillRect(0, 0, W, 48);
  ctx.strokeStyle = '#1a2240';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 48);
  ctx.lineTo(W, 48);
  ctx.stroke();
  [['#ff5f57', 28], ['#ffbd2e', 56], ['#28ca42', 84]].forEach(([color, x]) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, 24, 8, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.fillStyle = '#8b95c4';
  ctx.font = '500 18px "JetBrains Mono", "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('visitor@mingzhu — terminal', W / 2, 30);
  ctx.textAlign = 'left';
}

// Three-line profile shown on the (large) interactive screen. Each row is an
// accent label + a value, so the otherwise-empty middle of the big panel
// reads as a quick "about me" card without crowding the prompt/chips below.
const PROFILE_ROWS = [
  { label: 'stack', value: '6+ yrs · Vue · TS · React/Next · Java · Go · ELK' },
  { label: 'impact', value: '30% faster · 80% coverage · +25% productivity' },
  { label: 'volunteer', value: '8+ yrs · seniors & autism support · community learning' },
];

function drawIdleBanner(ctx, W, H, compact) {
  const cx = W / 2;

  if (compact) {
    // Small docked monitor (overview / driving): keep it to two lines.
    // Type is sized up so it stays legible from the overview camera distance.
    const cy = H / 2 - 16;
    ctx.textAlign = 'center';
    ctx.shadowColor = ACCENT;
    ctx.shadowBlur = 30;
    ctx.fillStyle = BRIGHT;
    ctx.font = '700 78px "Space Grotesk", system-ui, sans-serif';
    ctx.fillText("Hi — I'm Mingzhu", cx, cy);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#aebbe8';
    ctx.font = '600 40px "Space Grotesk", system-ui, sans-serif';
    ctx.fillText('Full-stack engineer · 6+ yrs', cx, cy + 62);
    ctx.textAlign = 'left';
    return;
  }

  // Large focus panel: headline + subtitle + a profile card.
  ctx.textAlign = 'center';
  ctx.shadowColor = ACCENT;
  ctx.shadowBlur = 22;
  ctx.fillStyle = BRIGHT;
  ctx.font = '700 40px "Space Grotesk", system-ui, sans-serif';
  ctx.fillText("Hi — I'm Mingzhu", cx, 104);
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#aebbe8';
  ctx.font = '600 19px "Space Grotesk", system-ui, sans-serif';
  ctx.fillText('Full-stack engineer · community volunteer', cx, 138);

  // Divider.
  ctx.strokeStyle = 'rgba(110,231,255,0.22)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(132, 162);
  ctx.lineTo(W - 132, 162);
  ctx.stroke();

  // Profile rows.
  let y = 200;
  for (const row of PROFILE_ROWS) {
    ctx.textAlign = 'right';
    ctx.fillStyle = ACCENT;
    ctx.font = '700 15px "JetBrains Mono", monospace';
    ctx.fillText(row.label, 196, y);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#c8d6f4';
    ctx.font = '500 15px "JetBrains Mono", monospace';
    ctx.fillText(row.value, 212, y);
    y += 32;
  }
  ctx.textAlign = 'left';
}

function drawResult(ctx, W, H, persona, sinceRun) {
  const cx = W / 2;
  const cy = 188;
  const hasMetric = persona.metric != null;

  ctx.textAlign = 'center';
  ctx.fillStyle = '#8b95c4';
  ctx.font = '600 18px "JetBrains Mono", monospace';
  ctx.fillText((persona.label ?? '').toUpperCase(), cx, cy - 70);

  if (hasMetric) {
    const cu = Math.min(1, Math.max(0, sinceRun) / COUNTUP_DURATION);
    const eased = 1 - Math.pow(1 - cu, 3);
    const value = Math.round((persona.metric ?? 0) * eased);
    const big = `${value}${persona.suffix ?? ''}`;

    ctx.shadowColor = ACCENT;
    ctx.shadowBlur = 44;
    ctx.fillStyle = ACCENT;
    ctx.font = '700 76px "Space Grotesk", system-ui, sans-serif';
    ctx.fillText(big, cx, cy);
    ctx.shadowBlur = 16;
    ctx.fillStyle = BRIGHT;
    ctx.fillText(big, cx, cy);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#aebbe8';
    ctx.font = '600 22px "Space Grotesk", system-ui, sans-serif';
    ctx.fillText(persona.headline ?? '', cx, cy + 42);
  } else {
    ctx.shadowColor = ACCENT;
    ctx.shadowBlur = 24;
    ctx.fillStyle = BRIGHT;
    ctx.font = '700 44px "Space Grotesk", system-ui, sans-serif';
    ctx.fillText(persona.headline ?? persona.output ?? '', cx, cy);
    ctx.shadowBlur = 0;
  }

  if (persona.sub) {
    ctx.fillStyle = DIM;
    ctx.font = '500 15px "JetBrains Mono", monospace';
    ctx.fillText(persona.sub, cx, cy + (hasMetric ? 74 : 40));
  }
  ctx.textAlign = 'left';
}

function drawHelp(ctx, W, H) {
  const x = 96;
  let y = 104;
  ctx.textAlign = 'left';
  ctx.fillStyle = DIM;
  ctx.font = '500 16px "JetBrains Mono", monospace';
  ctx.fillText('available commands:', x, y);
  y += 34;
  COMMANDS.forEach((c) => {
    ctx.fillStyle = ACCENT;
    ctx.font = '600 19px "JetBrains Mono", monospace';
    ctx.fillText(c.cmd, x, y);
    ctx.fillStyle = '#8b95c4';
    ctx.font = '500 17px "JetBrains Mono", monospace';
    ctx.fillText(`— ${c.desc}`, x + 150, y);
    y += 30;
  });
}

function drawError(ctx, W, H, badCmd) {
  const cx = W / 2;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff6b6b';
  ctx.font = '600 22px "JetBrains Mono", monospace';
  ctx.fillText(`command not found: ${badCmd ?? ''}`, cx, 170);
  ctx.fillStyle = DIM;
  ctx.font = '500 17px "JetBrains Mono", monospace';
  ctx.fillText('try: whoami · impact · coverage · volunteer · help', cx, 206);
  ctx.textAlign = 'left';
}

function drawPrompt(ctx, W, H, input, cursorOn, interactive, big) {
  const x = 70;
  // Big-chip (portrait) layout: the taller chip row below needs more room,
  // so the prompt slides up to keep clear of it.
  const y = H - (big ? 162 : 142);
  const prefix = 'visitor@mingzhu:~$ ';

  ctx.font = '500 20px "JetBrains Mono", "Courier New", monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  ctx.fillStyle = GREEN;
  ctx.fillText(prefix, x, y);
  const prefixW = ctx.measureText(prefix).width;

  ctx.fillStyle = BRIGHT;
  ctx.fillText(input ?? '', x + prefixW, y);
  const inputW = ctx.measureText(input ?? '').width;

  // Blinking block cursor (always blinks when interactive; steady underscore
  // when not, so the idle screen still reads as a console).
  if (!interactive || cursorOn) {
    ctx.fillStyle = interactive ? ACCENT : '#3a4380';
    ctx.fillRect(x + prefixW + inputW + 2, y - 18, 11, 22);
  }
}

function drawChips(ctx, W, H, activeCmd, hoveredChip, big) {
  // Big-chip (portrait/touch) layout: on a phone the whole focus panel is
  // only ~390 CSS px across, so the desktop chip row (40 px tall in a
  // 480-tall canvas) renders ~20 CSS px — half of a comfortable touch
  // target. Portrait draws taller chips with larger type instead.
  const y = H - (big ? 112 : 92);
  const h = big ? 60 : 40;
  const padX = big ? 18 : 16;
  const gap = big ? 13 : 12;
  const font = big
    ? '600 24px "JetBrains Mono", monospace'
    : '600 17px "JetBrains Mono", monospace';
  ctx.font = font;

  const widths = COMMANDS.map((c) => ctx.measureText(c.cmd).width + padX * 2);
  const total = widths.reduce((a, b) => a + b, 0) + gap * (COMMANDS.length - 1);
  let x = (W - total) / 2;

  const rects = [];
  COMMANDS.forEach((c, i) => {
    const w = widths[i];
    const isActive = c.cmd === activeCmd;
    const isHover = i === hoveredChip;

    roundRect(ctx, x, y, w, h, big ? 13 : 10);
    ctx.fillStyle = isHover ? 'rgba(110,231,255,0.20)' : 'rgba(110,231,255,0.07)';
    ctx.fill();
    ctx.lineWidth = isActive || isHover ? 2 : 1;
    ctx.strokeStyle = isActive ? ACCENT : isHover ? '#9fe6ff' : '#2b3566';
    ctx.stroke();

    ctx.fillStyle = isActive ? ACCENT : isHover ? BRIGHT : '#aab6e0';
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(c.cmd, x + w / 2, y + h / 2 + 1);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    rects.push({ cmd: c.cmd, x, y, w, h });
    x += w + gap;
  });
  return rects;
}

function drawHint(ctx, W, H, borderPulse, big) {
  const alpha = 0.55 + (Math.sin(borderPulse * 0.9) * 0.5 + 0.5) * 0.35;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#9fb4e8';
  ctx.font = big
    ? '500 18px "JetBrains Mono", monospace'
    : '500 14px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(
    big ? '▸ tap a command above' : '▸ type a command and hit Enter, or tap one above',
    W / 2,
    H - 28,
  );
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}

function drawBorder(ctx, W, H, borderPulse, interactive) {
  if (!interactive) return;
  ctx.strokeStyle = ACCENT;
  ctx.globalAlpha = 0.55 + Math.sin(borderPulse) * 0.12;
  ctx.lineWidth = 4;
  ctx.strokeRect(12, 12, W - 24, H - 24);
  ctx.globalAlpha = 1;
}

function drawScanlines(ctx, W, H) {
  ctx.globalAlpha = 0.04;
  ctx.fillStyle = '#000';
  for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
  ctx.globalAlpha = 1;
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
