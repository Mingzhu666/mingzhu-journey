import { useMemo } from 'react';
import * as THREE from 'three';
import { useJourney } from '../state/useJourney.js';
import { getPremiumSkylineSpecs } from './architectureVisuals.js';

export default function BackgroundCity() {
  const skyline = useMemo(() => getPremiumSkylineSpecs(), []);
  const viewMode = useJourney((s) => s.viewMode);

  return (
    <group renderOrder={-2} visible={viewMode === 'overview'}>
      {/* Backdrop haze + horizontal glow flattened to the night background
          colour so the overview reads as one uniform night tone instead of
          lighter-blue horizontal bands behind the skyline. */}
      <mesh position={skyline.haze.position}>
        <planeGeometry args={[skyline.haze.width, skyline.haze.height]} />
        <meshBasicMaterial
          color="#01050d"
          transparent
          opacity={0.34}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh position={[0, 1.62, -10.7]}>
        <planeGeometry args={[52, 3.2]} />
        <meshBasicMaterial
          color="#01050d"
          transparent
          opacity={0.08}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh position={[0, 0.18, -9.4]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[48, 3.2]} />
        <meshBasicMaterial
          color="#020713"
          transparent
          opacity={0.78}
          depthWrite={false}
        />
      </mesh>

      {skyline.towers.map((tower) => (
        <SkylineTower key={`${tower.x}:${tower.height}`} tower={tower} />
      ))}

      {skyline.windowSpecks.map((speck, i) => (
        <mesh key={i} position={[speck.x, speck.y, speck.z]}>
          <planeGeometry args={[speck.width, speck.height]} />
          <meshBasicMaterial
            color={speck.color}
            transparent
            opacity={speck.opacity}
            toneMapped={false}
            depthWrite={false}
          />
        </mesh>
      ))}

      {[-13.1, -4.4, 3.2, 11.8].map((x, i) => (
        <mesh key={x} position={[x, 1.02 + i * 0.08, -8.55]}>
          <cylinderGeometry args={[0.012, 0.012, 1.9 + i * 0.22, 8]} />
          <meshBasicMaterial
            color={i % 2 === 0 ? '#7dd3ff' : '#fcd34d'}
            transparent
            opacity={0.22}
            toneMapped={false}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

function SkylineTower({ tower }) {
  const y = tower.height / 2 - 0.12;

  return (
    <group position={[tower.x, 0, tower.z]}>
      <mesh position={[0, y, 0]} castShadow receiveShadow>
        <boxGeometry args={[tower.width, tower.height, tower.depth]} />
        <meshStandardMaterial
          color={tower.color}
          roughness={0.56}
          metalness={0.44}
          flatShading
        />
      </mesh>

      <mesh position={[0, y, tower.depth / 2 + 0.006]}>
        <planeGeometry args={[tower.width * 0.78, tower.height * 0.9]} />
        <meshBasicMaterial
          color="#173456"
          transparent
          opacity={0.18}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh position={[-tower.width / 2 - 0.006, y, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[tower.depth * 0.88, tower.height * 0.88]} />
        <meshBasicMaterial
          color="#01050d"
          transparent
          opacity={0.34}
          depthWrite={false}
        />
      </mesh>

      {tower.setbacks.map((scale, i) => (
        <mesh
          key={i}
          position={[0, tower.height + 0.02 + i * 0.15, 0]}
          castShadow
        >
          <boxGeometry
            args={[
              tower.width * scale,
              0.16,
              tower.depth * Math.max(0.52, scale - 0.06),
            ]}
          />
          <meshStandardMaterial
            color={i % 2 === 0 ? '#101c32' : '#0a1325'}
            roughness={0.48}
            metalness={0.58}
            flatShading
          />
        </mesh>
      ))}

      <Crown tower={tower} />

      {tower.spire && (
        <group position={[0, tower.height + 0.45 + tower.setbacks.length * 0.08, 0]}>
          <mesh>
            <cylinderGeometry args={[0.012, 0.018, 0.86, 8]} />
            <meshBasicMaterial
              color={tower.accent}
              transparent
              opacity={0.72}
              toneMapped={false}
            />
          </mesh>
          <mesh position={[0, 0.46, 0]}>
            <sphereGeometry args={[0.028, 10, 10]} />
            <meshBasicMaterial color="#e0f2fe" toneMapped={false} />
          </mesh>
        </group>
      )}

      <mesh position={[0, 0.04, 0]}>
        <boxGeometry args={[tower.width * 1.24, 0.06, tower.depth * 1.28]} />
        <meshStandardMaterial
          color="#050914"
          roughness={0.64}
          metalness={0.48}
        />
      </mesh>

      <mesh position={[0, 0.095, tower.depth / 2 + 0.015]}>
        <planeGeometry args={[tower.width * 0.92, 0.018]} />
        <meshBasicMaterial
          color={tower.accent}
          transparent
          opacity={0.32}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

function Crown({ tower }) {
  const y = tower.height + 0.1 + tower.setbacks.length * 0.1;

  if (tower.crown === 'terrace') {
    return (
      <group position={[0, y, 0]}>
        {[0, 1].map((i) => (
          <mesh key={i} position={[0, i * 0.11, 0]}>
            <boxGeometry
              args={[
                tower.width * (0.82 - i * 0.16),
                0.08,
                tower.depth * (0.78 - i * 0.12),
              ]}
            />
            <meshStandardMaterial color="#13213a" roughness={0.42} metalness={0.62} />
          </mesh>
        ))}
        <mesh position={[0, 0.18, tower.depth * 0.32]}>
          <planeGeometry args={[tower.width * 0.5, 0.025]} />
          <meshBasicMaterial color={tower.accent} transparent opacity={0.42} toneMapped={false} />
        </mesh>
      </group>
    );
  }

  if (tower.crown === 'lantern') {
    return (
      <group position={[0, y, 0]}>
        <mesh>
          <boxGeometry args={[tower.width * 0.58, 0.18, tower.depth * 0.58]} />
          <meshStandardMaterial color="#111d34" roughness={0.36} metalness={0.66} />
        </mesh>
        <mesh position={[0, 0.02, tower.depth * 0.3 + 0.004]}>
          <planeGeometry args={[tower.width * 0.38, 0.08]} />
          <meshBasicMaterial color={tower.accent} transparent opacity={0.34} toneMapped={false} />
        </mesh>
      </group>
    );
  }

  if (tower.crown === 'needle') {
    return (
      <group position={[0, y, 0]}>
        <mesh rotation={[0, Math.PI / 4, 0]}>
          <coneGeometry args={[tower.width * 0.34, 0.36, 4]} />
          <meshStandardMaterial color="#14213a" roughness={0.38} metalness={0.62} />
        </mesh>
        <mesh position={[0, -0.12, tower.depth * 0.34 + 0.004]}>
          <planeGeometry args={[tower.width * 0.42, 0.028]} />
          <meshBasicMaterial color={tower.accent} transparent opacity={0.44} toneMapped={false} />
        </mesh>
      </group>
    );
  }

  if (tower.crown === 'deco') {
    return (
      <group position={[0, y, 0]}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} position={[0, i * 0.08, 0]}>
            <boxGeometry
              args={[
                tower.width * (0.76 - i * 0.14),
                0.06,
                tower.depth * (0.78 - i * 0.12),
              ]}
            />
            <meshStandardMaterial color="#172441" roughness={0.36} metalness={0.7} />
          </mesh>
        ))}
        <mesh position={[0, 0.18, tower.depth * 0.35 + 0.004]}>
          <planeGeometry args={[tower.width * 0.62, 0.035]} />
          <meshBasicMaterial color="#fcd34d" transparent opacity={0.5} toneMapped={false} />
        </mesh>
      </group>
    );
  }

  return (
    <mesh position={[0, y, 0]}>
      <boxGeometry args={[tower.width * 0.72, 0.08, tower.depth * 0.72]} />
      <meshStandardMaterial color="#111d34" roughness={0.45} metalness={0.6} />
    </mesh>
  );
}
