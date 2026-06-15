import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Occasional shooting stars streaking across the upper sky. Kept sparse and
// far-field so they read as ambient atmosphere, not a fireworks show.
//
// The look is "natural night sky", not "clockwork": rather than every meteor
// sharing one direction and replaying on a fixed loop, each meteor lives its
// own life. It waits a random gap, streaks across with its own slight slant /
// speed / length, then — crucially — RE-ROLLS all of its parameters before the
// next appearance. Nothing ever repeats, so the shower never reveals a loop.
// They still share a dominant fall direction (down-left) with only a small
// per-meteor tilt, so it reads as one coherent shower, not random scatter.
// Tune METEOR_COUNT for more/fewer.
const METEOR_COUNT = 6;
const TAIL_COLORS = ['#cfe9ff', '#bfe9ff', '#dceeff', '#ffe3b8'];
const TAIL_OPACITY = 0.56;
const HEAD_OPACITY = 0.72;

// Shared fall direction — EVERY meteor falls at this exact angle so the shower
// reads as one clean, uniform streak rather than scattered drift. Only the
// timing, start point, speed and length vary. (x = sideways, y = downward,
// z = toward/away.) Change SHARED_DIR to re-aim the whole shower.
const Z_AXIS = new THREE.Vector3(0, 0, 1);
const SHARED_DIR = new THREE.Vector3(-0.62, -0.46, 0).normalize();
const SHARED_QUAT = new THREE.Quaternion().setFromUnitVectors(Z_AXIS, SHARED_DIR);

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];

// Re-roll every randomisable property of a meteor. Called once at birth and
// again every time the meteor finishes a streak, so each pass is unique.
// Direction is intentionally NOT randomised — they all share one slant.
// `time` is the current clock time; the meteor stays hidden until `t0`.
function rollMeteor(m, time, firstRoll) {
  m.start = new THREE.Vector3(rand(-32, 44), rand(10, 20), rand(-50, -28));
  m.dir = SHARED_DIR;
  m.quat = SHARED_QUAT;
  m.speed = rand(20, 36);
  m.length = rand(3.8, 7.0);
  m.duration = rand(1.5, 2.6);
  m.bright = rand(0.8, 1.12);
  m.color = pick(TAIL_COLORS);
  // First appearance is scattered across a wide window so they don't all kick
  // off together; afterwards each waits a fresh random gap. The wide jitter is
  // what makes the rhythm feel irregular instead of metronomic.
  m.t0 = time + (firstRoll ? rand(0, 9) : rand(2.8, 9.5));
  m.dirty = true; // geometry / orientation needs to be re-applied
}

export default function Meteors({ active = true }) {
  const meteors = useMemo(() => {
    const arr = Array.from({ length: METEOR_COUNT }, () => ({}));
    arr.forEach((m) => rollMeteor(m, 0, true));
    return arr;
  }, []);
  const groupRefs = useRef([]);
  const tailRefs = useRef([]);
  const tailMats = useRef([]);
  const headMats = useRef([]);

  useFrame((state) => {
    // When inactive (e.g. Tour mode) we stay mounted to keep shaders warm,
    // but hide every meteor and skip the animation work.
    if (!active) {
      for (let i = 0; i < METEOR_COUNT; i++) {
        const g = groupRefs.current[i];
        if (g) g.visible = false;
      }
      return;
    }
    const time = state.clock.elapsedTime;
    for (let i = 0; i < METEOR_COUNT; i++) {
      const m = meteors[i];
      const g = groupRefs.current[i];
      if (!g) continue;

      // Apply freshly-rolled orientation + tail length once per roll.
      if (m.dirty) {
        g.quaternion.copy(m.quat);
        const tail = tailRefs.current[i];
        if (tail) {
          tail.scale.z = m.length;
          tail.position.z = -m.length / 2;
        }
        if (tailMats.current[i]) tailMats.current[i].color.set(m.color);
        if (headMats.current[i]) headMats.current[i].color.set(m.color);
        m.dirty = false;
      }

      // Not yet time to appear.
      if (time < m.t0) {
        g.visible = false;
        continue;
      }

      const localT = time - m.t0;
      if (localT <= m.duration) {
        const travel = m.speed * localT;
        g.position.set(
          m.start.x + m.dir.x * travel,
          m.start.y + m.dir.y * travel,
          m.start.z + m.dir.z * travel,
        );
        g.visible = true;
        // Ease opacity in then out across the visible window.
        const fade = Math.sin((localT / m.duration) * Math.PI);
        const eased = fade * fade * m.bright;
        if (tailMats.current[i]) tailMats.current[i].opacity = eased * TAIL_OPACITY;
        if (headMats.current[i]) headMats.current[i].opacity = eased * HEAD_OPACITY;
      } else {
        // Finished this streak — hide and re-roll for a brand new one.
        g.visible = false;
        rollMeteor(m, time, false);
      }
    }
  });

  return (
    <>
      {meteors.map((m, i) => (
        <group
          key={i}
          ref={(el) => (groupRefs.current[i] = el)}
          visible={false}
        >
          {/* Streak tail — unit-length box scaled per-roll to vary length. */}
          <mesh ref={(el) => (tailRefs.current[i] = el)}>
            <boxGeometry args={[0.038, 0.038, 1]} />
            <meshBasicMaterial
              ref={(el) => (tailMats.current[i] = el)}
              color={m.color}
              transparent
              opacity={0}
              toneMapped={false}
              depthWrite={false}
            />
          </mesh>
          {/* Bright head — blooms into a point of light via PostFX. */}
          <mesh>
            <sphereGeometry args={[0.07, 10, 10]} />
            <meshBasicMaterial
              ref={(el) => (headMats.current[i] = el)}
              color={m.color}
              transparent
              opacity={0}
              toneMapped={false}
              depthWrite={false}
            />
          </mesh>
        </group>
      ))}
    </>
  );
}
