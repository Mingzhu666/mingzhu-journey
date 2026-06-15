import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import gsap from 'gsap';
import { useJourney } from '../state/useJourney.js';
import { setJourneyProgress } from '../state/journeyProgress.js';
import { curve, stationT } from './track.js';

// The Car is the protagonist of the scene. It now renders a real GLB model
// instead of the old box-art car. Every frame it:
//   1) Reads its current parameter `t` along the track.
//   2) Samples position + tangent on the curve to place + aim itself.
//   3) Adds a tiny floating bob so it doesn't look glued to the rail.
//
// State coordination: `t` is owned by a ref and tweened with GSAP whenever
// `currentIndex` flips. Each frame we push normalized progress to a tiny
// mutable module value so the camera can follow without waking React.

const CAR_MODEL = '/models/car.min.glb';
// Tuning knobs — eyeball these against the platforms.
const MODEL_SCALE = 1.4; // model is ~1.12 long raw → ~1.56 on track
const MODEL_YAW = 0; // set to Math.PI if the car drives REAR-first
const GROUND_CLEAR = 0.02; // tiny gap so the wheels kiss the deck

useGLTF.preload(CAR_MODEL);

export default function Car() {
  const carRef = useRef();
  const tRef = useRef({ value: stationT[0] });
  const prevPos = useMemo(() => new THREE.Vector3(), []);

  const currentIndex = useJourney((s) => s.currentIndex);
  const setDriving = useJourney((s) => s.setDriving);

  // Load + clone the model so this instance owns its own materials, and turn
  // on shadow casting for every mesh.
  const { scene } = useGLTF(CAR_MODEL);
  const model = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = false;
      }
    });
    return c;
  }, [scene]);

  // GSAP tween whenever the destination station changes.
  useEffect(() => {
    const target = stationT[currentIndex];
    if (Math.abs(tRef.current.value - target) < 1e-4) return;

    setDriving(true);
    const tween = gsap.to(tRef.current, {
      value: target,
      duration: 1.8,
      ease: 'power2.inOut',
      onComplete: () => setDriving(false),
    });
    return () => tween.kill();
  }, [currentIndex, setDriving]);

  // Initialize position so the car doesn't visibly jump in on frame 1.
  useEffect(() => {
    const p = curve.getPoint(stationT[0]);
    prevPos.copy(p);
    if (carRef.current) carRef.current.position.set(p.x, p.y + GROUND_CLEAR, p.z);
  }, [prevPos]);

  useFrame((state) => {
    if (!carRef.current) return;

    const t = THREE.MathUtils.clamp(tRef.current.value, 0, 1);
    const pos = curve.getPoint(t);
    const tan = curve.getTangent(t).normalize();

    // Position with a subtle hover bob.
    const bob = Math.sin(state.clock.elapsedTime * 3.2) * 0.012;
    carRef.current.position.set(pos.x, pos.y + GROUND_CLEAR + bob, pos.z);

    // Orientation: the group's local -Z points toward travel. lookAt does that.
    carRef.current.lookAt(pos.x + tan.x, carRef.current.position.y, pos.z + tan.z);

    prevPos.copy(pos);
    setJourneyProgress(t);
  });

  return (
    <group ref={carRef}>
      {/* Underglow strip — an emissive (unlit) mesh that glows via bloom, so
          the extra cyan point light that used to sit here was redundant and
          just padded the forward-renderer per-pixel light loop. Removed to
          help cut walk-in black-frame flicker. */}
      <mesh position={[0, 0.03, 0]}>
        <boxGeometry args={[0.62, 0.02, 1.18]} />
        <meshBasicMaterial color="#6ee7ff" toneMapped={false} />
      </mesh>

      {/* Headlight + overhead key lights removed (unified-lighting pass):
          two moving point lights sweeping across buildings broke the single
          colour-temperature look. The underglow strip above plus the global
          moonlight keep the car readable. */}

      {/* The car model */}
      <primitive object={model} scale={MODEL_SCALE} rotation={[0, MODEL_YAW, 0]} position={[0, 0, 0]} />
    </group>
  );
}
