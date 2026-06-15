import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Preload } from '@react-three/drei';
import * as THREE from 'three';
import Scene from './scene/Scene.jsx';
import Overlay from './ui/Overlay.jsx';
import EducationBookOverlay from './ui/EducationBookOverlay.jsx';
import FinanceCoinOverlay from './ui/FinanceCoinOverlay.jsx';
import EnergyReactorOverlay from './ui/EnergyReactorOverlay.jsx';
import ProjectsShowcaseOverlay from './ui/ProjectsShowcaseOverlay.jsx';
import ConnectOverlay from './ui/ConnectOverlay.jsx';
import Loader from './ui/Loader.jsx';
import { useDeviceProfile } from './state/useDeviceProfile.js';
import { useJourney } from './state/useJourney.js';
import { useUrlSync } from './state/urlSync.js';

// App wires the R3F Canvas, the HTML overlay, and the loading screen.
// The Canvas is configured for a cinematic feel: ACES tone mapping,
// soft shadows, a moderate dpr cap so it stays smooth on retina.

// Black-flicker mitigation: the scene runs a forward renderer with many
// dynamic lights + emissive materials. The first time any material is
// drawn (initial load, a model streaming in, a mode switch), three.js has
// to compile its shader program, and the mesh renders black for a frame
// or two while that happens. <Preload all /> compiles everything up front
// so those first-draw black frames don't reach the screen. We also guard
// against WebGL context loss, which otherwise leaves a permanently black
// canvas on GPUs that get starved.

export default function App() {
  // Same scene on every device — but a phone GPU can't pay the desktop's
  // pixel-density + shadow cost. Scale those by the device tier so the full
  // diorama still runs smoothly on a phone instead of dropping frames / black
  // frames. (Per-light shadows and the bloom pass scale in Environment/PostFX.)
  const { tier } = useDeviceProfile();
  const setSceneReady = useJourney((s) => s.setSceneReady);

  // Deep-link each building to its own URL (/welcome, /EDUCATION, /FNZ, …) and
  // keep the address bar in sync as the visitor moves through the tour.
  useUrlSync();
  const dpr = tier === 'high' ? [1, 1.5] : tier === 'mid' ? [1, 1.25] : [1, 1];
  const shadows = tier !== 'low';

  return (
    <>
      <Canvas
        shadows={shadows}
        dpr={dpr}
        camera={{ position: [0, 6, 18], fov: 38, near: 0.1, far: 200 }}
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
          alpha: false,
        }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          // Lifted from 0.76 → 0.9 so the diorama reads brighter on first load
          // (overview was crushing the midtones). Bloom carries the highlights.
          gl.toneMappingExposure = 0.9;

          // Recover from a lost GPU context instead of showing a black
          // canvas. preventDefault() lets the browser fire a "restored"
          // event, after which three.js rebuilds its resources.
          const canvas = gl.domElement;
          canvas.addEventListener(
            'webglcontextlost',
            (e) => {
              e.preventDefault();
              console.warn('[portfolio] WebGL context lost — attempting restore');
            },
            false,
          );
          canvas.addEventListener('webglcontextrestored', () => {
            console.warn('[portfolio] WebGL context restored');
          });
        }}
      >
        <Suspense fallback={null}>
          <Scene />
          {/* Warm the shader cache for everything currently in the scene
              so first-appearance black frames never reach the screen. */}
          <Preload all />
        </Suspense>
      </Canvas>
      <Overlay />
      <EducationBookOverlay />
      <FinanceCoinOverlay />
      <EnergyReactorOverlay />
      <ProjectsShowcaseOverlay />
      <ConnectOverlay />
      <Loader onHidden={setSceneReady} />
    </>
  );
}
