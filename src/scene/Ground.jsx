import { useMemo } from 'react';
import * as THREE from 'three';

// The world floor. Two layers:
//   1) A big dark disc that catches subtle shadows from the diorama.
//   2) A thin emissive ring at the disc's edge so the world has a clear
//      boundary instead of fading awkwardly into the fog.
//
// We keep this minimal because the diorama is the visual hero — the
// ground exists mainly to ground the platforms and accept shadows.

export default function Ground() {
  // A simple radial gradient is hard in plain materials, so we cheat with
  // a vertex-color disc: edge vertices darker, center brighter.
  const gridGeometry = useMemo(() => {
    const geom = new THREE.PlaneGeometry(120, 60, 60, 30);
    return geom;
  }, []);

  return (
    <group>
      {/* Base plate (very dark, receives shadows) */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.12, 0]}
        receiveShadow
      >
        <planeGeometry args={[120, 60]} />
        <meshBasicMaterial color="#02060f" />
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

      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.11, 8.2]}
      >
        <planeGeometry args={[46, 4]} />
        <meshBasicMaterial
          color="#061426"
          transparent
          opacity={0.42}
          depthWrite={false}
        />
      </mesh>

      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.105, 0.56]}
      >
        <planeGeometry args={[34, 1.05]} />
        <meshBasicMaterial
          color="#07101d"
          transparent
          opacity={0.78}
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
