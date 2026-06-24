import { useMemo } from 'react';
import * as THREE from 'three';
import { MeshReflectorMaterial } from '@react-three/drei';
import { useDeviceProfile } from '../state/useDeviceProfile.js';

// The world floor. The hero upgrade here is a real-time REFLECTIVE wet
// surface: the neon diorama mirrors down into the foreground like a rain-
// slicked plaza — the single biggest "premium / cinematic" cue for a neon
// city. It's driven by drei's MeshReflectorMaterial (a planar reflection
// render target), so it stays fully real-time and interactive.
//
// Performance: the reflection re-renders the scene into an offscreen target,
// so its resolution + blur are scaled by the device tier, and on low-end
// GPUs it falls back to the original flat matte plate (no reflection pass at
// all). This keeps phones smooth while desktops get the full wet-floor look.
//
// On top of the reflector sit the same thin neon markings as before — they
// now read as road lines on a wet surface (the toned-down dark road strips
// let the reflection show through instead of hiding it).

// Real-time floor reflection (MeshReflectorMaterial) is the single biggest
// visual upgrade — but it re-renders the WHOLE scene into an offscreen target
// every frame, ~doubling GPU cost. On some Apple GPUs that pushes a frame over
// budget and brings back the random black-flash this project worked hard to
// eliminate. So it lives behind this switch and is OFF by default. Turn it on
// ONLY if your machine stays perfectly smooth (no black flashes) with it on.
const ENABLE_REFLECTION = false;

export default function Ground() {
  const { tier } = useDeviceProfile();

  // Reflection budget per tier. `null` => no reflection (flat matte plate).
  // Resolutions kept conservative so that, IF enabled, the extra full-scene
  // render stays as cheap as possible.
  const refl = useMemo(() => {
    if (!ENABLE_REFLECTION) return null; // safe default: cheap flat matte floor
    if (tier === 'high') return { resolution: 512, blur: [60, 22], mixStrength: 8 };
    if (tier === 'mid') return { resolution: 256, blur: [40, 16], mixStrength: 7 };
    return null; // low tier: always flat
  }, [tier]);

  // A simple radial gradient is hard in plain materials, so we cheat with
  // a vertex-color disc: edge vertices darker, center brighter.
  const gridGeometry = useMemo(() => {
    const geom = new THREE.PlaneGeometry(120, 60, 60, 30);
    return geom;
  }, []);

  return (
    <group>
      {/* Base plate — reflective wet surface (desktop/mid) or flat matte
          (low tier). Still receives the diorama's shadows either way. */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.12, 0]}
        receiveShadow
      >
        <planeGeometry args={[120, 60]} />
        {refl ? (
          <MeshReflectorMaterial
            resolution={refl.resolution}
            blur={refl.blur}
            mixBlur={1}
            mixStrength={refl.mixStrength}
            mixContrast={1.25}
            mirror={1}
            // Wet sheen, softened — not a perfect chrome mirror. NOTE: the
            // depth-fade params (depthScale/min/maxDepthThreshold) were removed
            // because they were fading the entire reflection out to nothing,
            // which is why no reflection showed at all. We get the "wet" look
            // from blur + roughness instead.
            roughness={0.45}
            metalness={0.45}
            // Dark cool base tint; the mirrored neon is added on top.
            color="#0a1626"
          />
        ) : (
          <meshBasicMaterial color="#02060f" />
        )}
      </mesh>

      {/* Soft floor glow under the diorama so the foreground floor reads
          instead of dropping to pure black. */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.112, -0.8]}
      >
        <circleGeometry args={[28, 72]} />
        <meshBasicMaterial
          color="#01050d"
          transparent
          opacity={0.1}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>

      {/* Faint horizon glow far behind the station row, so the back of the
          world fades into a cool haze rather than a hard black edge. */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.118, -16]}
      >
        <planeGeometry args={[120, 26]} />
        <meshBasicMaterial
          color="#01050d"
          transparent
          opacity={0.14}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>

      {/* Foreground road band — toned down (was 0.42) so the wet-floor
          reflection shows through instead of being masked by flat dark. */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.11, 8.2]}
      >
        <planeGeometry args={[46, 4]} />
        <meshBasicMaterial
          color="#061426"
          transparent
          opacity={refl ? 0.1 : 0.42}
          depthWrite={false}
        />
      </mesh>

      {/* Central road band under the stations — toned down (was 0.78) so the
          reflection reads as a wet surface beneath the buildings. */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.105, 0.56]}
      >
        <planeGeometry args={[34, 1.05]} />
        <meshBasicMaterial
          color="#07101d"
          transparent
          opacity={refl ? 0.2 : 0.78}
          depthWrite={false}
        />
      </mesh>

      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.1, 1.28]}
      >
        <planeGeometry args={[34, 0.08]} />
        <meshBasicMaterial
          color="#38bdf8"
          transparent
          opacity={0.16}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>

      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.1, -0.18]}
      >
        <planeGeometry args={[34, 0.055]} />
        <meshBasicMaterial
          color="#7c8cff"
          transparent
          opacity={0.105}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>

      {[-12, -8, -4, 0, 4, 8, 12].map((x, i) => (
        <mesh
          key={i}
          rotation={[-Math.PI / 2, 0, Math.PI / 6]}
          position={[x, -0.096, 0.54]}
        >
          <planeGeometry args={[1.4, 0.028]} />
          <meshBasicMaterial
            color={i % 2 === 0 ? '#38bdf8' : '#ffd166'}
            transparent
            opacity={0.18}
            toneMapped={false}
            depthWrite={false}
          />
        </mesh>
      ))}

      {/* Subtle grid overlay (just a wireframe at low opacity) */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.115, 0]}
        geometry={gridGeometry}
      >
        <meshBasicMaterial
          color="#0a2038"
          wireframe
          transparent
          opacity={0.072}
        />
      </mesh>
    </group>
  );
}
