import { useMemo } from 'react';
import * as THREE from 'three';

// Decoration scattered around the diorama: a few low-poly trees,
// lampposts and rocks that fill in the space between station platforms.
// All positions are seeded so the layout is deterministic — the same
// every reload, which is important when you're showing this to anyone.

const SEED = 4242;
function seededRand(seedRef) {
  // Mulberry32 — tiny deterministic PRNG.
  let t = (seedRef.value += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export default function AmbientProps() {
  const items = useMemo(() => {
    const seed = { value: SEED };
    const out = [];

    // Decoration sits behind and beside the stations. Two bands:
    //   • Back: far behind stations, building a "skyline" silhouette.
    //   • Far front: way past the track on the horizon, hinting at the
    //     world continuing — but well clear of the rail at z ≈ 8.
    const xRange = [-28, 28];
    const zBands = [
      [-12, -5], // behind the station row (which sits around z = -1.5)
      [15, 20], // beyond the track, near the horizon
    ];
    const COUNT = 42;

    for (let i = 0; i < COUNT; i++) {
      const r = seededRand(seed);
      const x = xRange[0] + r * (xRange[1] - xRange[0]);
      const band = zBands[i % 2];
      const z = band[0] + seededRand(seed) * (band[1] - band[0]);
      const type = seededRand(seed);
      const scale = 0.7 + seededRand(seed) * 0.6;
      const rot = seededRand(seed) * Math.PI * 2;
      out.push({ x, z, type, scale, rot, id: i });
    }
    return out;
  }, []);

  return (
    <group>
      {items.map((it) =>
        it.type < 0.55 ? (
          <Tree key={it.id} position={[it.x, 0, it.z]} scale={it.scale} rotationY={it.rot} />
        ) : it.type < 0.85 ? (
          <Rock key={it.id} position={[it.x, 0, it.z]} scale={it.scale} rotationY={it.rot} />
        ) : (
          <Lamp key={it.id} position={[it.x, 0, it.z]} />
        ),
      )}
    </group>
  );
}

function Tree({ position, scale, rotationY }) {
  return (
    <group position={position} scale={scale} rotation={[0, rotationY, 0]}>
      <mesh position={[0, 0.3, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.08, 0.5, 6]} />
        <meshStandardMaterial color="#2a1d3a" roughness={0.9} flatShading />
      </mesh>
      <mesh position={[0, 0.85, 0]} castShadow>
        <coneGeometry args={[0.36, 0.7, 7]} />
        <meshStandardMaterial color="#2a3160" roughness={0.85} flatShading />
      </mesh>
      <mesh position={[0, 1.25, 0]} castShadow>
        <coneGeometry args={[0.26, 0.5, 7]} />
        <meshStandardMaterial color="#3a4380" roughness={0.85} flatShading />
      </mesh>
    </group>
  );
}

function Rock({ position, scale, rotationY }) {
  return (
    <group position={position} scale={scale} rotation={[0, rotationY, 0]}>
      <mesh position={[0, 0.12, 0]} castShadow>
        <dodecahedronGeometry args={[0.25, 0]} />
        <meshStandardMaterial color="#1a1f3a" roughness={0.95} flatShading />
      </mesh>
    </group>
  );
}

function Lamp({ position }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.6, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.05, 1.2, 6]} />
        <meshStandardMaterial color="#11183a" />
      </mesh>
      <mesh position={[0, 1.3, 0]}>
        <sphereGeometry args={[0.1, 12, 12]} />
        <meshBasicMaterial color="#fde047" toneMapped={false} />
      </mesh>
      {/* Lamp point light removed (unified-lighting pass): the emissive bulb
          mesh + bloom still glows; ~6 scattered yellow point lights were a
          third colour temperature fighting the global moonlight. */}
    </group>
  );
}
