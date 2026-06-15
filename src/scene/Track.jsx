import { useMemo } from 'react';
import * as THREE from 'three';
import { curve, trackSamples } from './track.js';
import { resolveTrackVisuals } from './stationVisuals.js';

// The roadway. Rebuilt as ONE continuous ribbon that follows the curve,
// rather than dozens of discrete deck boxes (which read as a segmented,
// faceted road on the bends). The ribbon gives:
//   • a smooth dark deck,
//   • two crisp glowing edge lines that run unbroken end-to-end,
//   • a flowing "energy" center line (a scrolling texture) for motion,
//   • a soft under-glow breath,
//   • a few node plates at intervals for rhythm.
const TRACK_VISUALS = resolveTrackVisuals();
const HALF = TRACK_VISUALS.roadWidth / 2; // deck half-width

// Build a flat ribbon BufferGeometry that follows `points`, centred on the
// curve plus an optional lateral `offset`, with total width `width`, sitting
// `lift` above each sample. UVs run u→length, v→across, so a repeating
// texture can flow along the road.
function buildRibbon(points, { offset = 0, width = 1, lift = 0 } = {}) {
  const n = points.length;
  const half = width / 2;
  const positions = new Float32Array(n * 2 * 3);
  const uvs = new Float32Array(n * 2 * 2);
  const indices = [];
  const up = new THREE.Vector3(0, 1, 0);
  const tan = new THREE.Vector3();
  const nor = new THREE.Vector3();

  for (let i = 0; i < n; i++) {
    const p = points[i];
    const a = points[Math.max(0, i - 1)];
    const b = points[Math.min(n - 1, i + 1)];
    tan.set(b.x - a.x, 0, b.z - a.z).normalize();
    nor.crossVectors(up, tan).normalize(); // lateral in XZ plane
    const cx = p.x + nor.x * offset;
    const cz = p.z + nor.z * offset;
    const y = p.y + lift;
    const u = i / (n - 1);

    const li = i * 2 * 3;
    positions[li + 0] = cx + nor.x * half;
    positions[li + 1] = y;
    positions[li + 2] = cz + nor.z * half;
    positions[li + 3] = cx - nor.x * half;
    positions[li + 4] = y;
    positions[li + 5] = cz - nor.z * half;

    const ui = i * 2 * 2;
    uvs[ui + 0] = u; uvs[ui + 1] = 0;
    uvs[ui + 2] = u; uvs[ui + 3] = 1;

    if (i < n - 1) {
      const k = i * 2;
      indices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

// A small canvas texture: one soft bright band per tile. Repeated + scrolled,
// it reads as a stream of light flowing down the centre of the road.
function makeFlowTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 4;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 64, 0);
  g.addColorStop(0.0, 'rgba(255,255,255,0)');
  g.addColorStop(0.35, 'rgba(150,238,255,0)');
  g.addColorStop(0.5, 'rgba(190,245,255,0.95)');
  g.addColorStop(0.65, 'rgba(150,238,255,0)');
  g.addColorStop(1.0, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 4);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.repeat.set(54, 1); // ~54 light pulses along the whole road
  return tex;
}

export default function Track() {
  const geom = useMemo(() => {
    const pts = trackSamples;
    return {
      deck: buildRibbon(pts, { offset: 0, width: TRACK_VISUALS.roadWidth, lift: 0.0 }),
      edgeL: buildRibbon(pts, { offset: HALF - 0.03, width: 0.05, lift: 0.045 }),
      edgeR: buildRibbon(pts, { offset: -(HALF - 0.03), width: 0.05, lift: 0.045 }),
      center: buildRibbon(pts, { offset: 0, width: 0.12, lift: 0.05 }),
      underglow: buildRibbon(pts, { offset: 0, width: TRACK_VISUALS.roadWidth + 0.5, lift: -0.04 }),
    };
  }, []);

  const flowTex = useMemo(() => makeFlowTexture(), []);

  // Node plates at intervals along the bends — kept for rhythm.
  const nodePlatforms = useMemo(() => {
    const nodes = [];
    for (let i = 0; i < trackSamples.length; i += TRACK_VISUALS.nodeEvery) {
      const p = trackSamples[i];
      const tangent = curve.getTangentAt(Math.min(0.9999, i / (trackSamples.length - 1)));
      nodes.push({
        position: [p.x, p.y - 0.05, p.z],
        rotationY: Math.atan2(tangent.x, tangent.z),
      });
    }
    return nodes;
  }, []);

  return (
    <group>
      {/* Soft under-glow breath beneath the deck */}
      <mesh geometry={geom.underglow}>
        <meshBasicMaterial
          color="#5bd8ff"
          transparent
          opacity={0.05}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>

      {/* Smooth continuous deck */}
      <mesh geometry={geom.deck} receiveShadow>
        <meshStandardMaterial color="#0a1322" roughness={0.62} metalness={0.45} />
      </mesh>

      {/* Crisp glowing edge lines (unbroken end-to-end) */}
      <mesh geometry={geom.edgeL}>
        <meshBasicMaterial color="#6ee7ff" toneMapped={false} transparent opacity={0.92} />
      </mesh>
      <mesh geometry={geom.edgeR}>
        <meshBasicMaterial color="#6ee7ff" toneMapped={false} transparent opacity={0.92} />
      </mesh>

      {/* Flowing centre energy line */}
      <mesh geometry={geom.center}>
        <meshBasicMaterial
          map={flowTex}
          color="#bff4ff"
          transparent
          opacity={0.62}
          toneMapped={false}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Node plates at the bends */}
      {nodePlatforms.map((m, i) => (
        <group key={i} position={m.position} rotation={[0, m.rotationY, 0]}>
          <mesh receiveShadow castShadow>
            <cylinderGeometry args={[0.6, 0.7, 0.08, 8]} />
            <meshStandardMaterial color="#08111e" roughness={0.66} metalness={0.44} flatShading />
          </mesh>
          <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.34, 0.42, 32]} />
            <meshBasicMaterial color="#4fc3ff" transparent opacity={0.4} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
