import { Suspense, useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useJourney } from '../state/useJourney.js';
import Track from './Track.jsx';
import Car from './Car.jsx';
import Stations from './Stations.jsx';
import Ground from './Ground.jsx';
import BackgroundCity from './BackgroundCity.jsx';
// import AmbientProps from './AmbientProps.jsx'; // disabled — trees/rocks/lamps temporarily off
import Environment from './Environment.jsx';
import CameraRig from './CameraRig.jsx';
import PostFX from './PostFX.jsx';
import StageSpotlight from './StageSpotlight.jsx';

// Top-level scene composition for the main diorama.

// POST-PROCESSING TOGGLE.
// Keep the raw WebGL render path while chasing intermittent black flashing.
// The scene still renders normally; it just avoids the EffectComposer/Bloom
// render target path that is the most common source of full-screen black
// frames on macOS/Apple GPU WebGL.
// Re-enabled so the VolunteerTower neon shaders actually glow — the neon
// look depends on the Bloom pass turning bright (>1) pixels into halos.
// (PostFX.jsx keeps the macOS-flicker mitigations: HalfFloatType buffer,
// no chromatic aberration, minimal passes.) If black flashing returns on
// Apple GPUs, set this back to false — the scene still renders, just flat.
const ENABLE_POSTFX = true;

// Freezes the directional shadow map whenever the scene is parked & settled.
// Re-rendering the 2048² shadow map every frame is pure GPU cost; during a
// close walk-in (when one building fills the screen) that cost — stacked on
// the point-light loop — is what tips a frame into a dropped/black frame on
// light-heavy GPUs. The buildings are static, so we only refresh shadows
// while something is actually moving (driving, a view-mode switch, or a
// station change) plus a short settle tail for the eased slide/zoom, then
// freeze them. When parked the shadow pass costs nothing — which is exactly
// the moment the flicker used to appear.
function ShadowControl() {
  const gl = useThree((s) => s.gl);
  const refresh = useRef(2.0); // seconds of "keep updating" remaining
  const prev = useRef({ idx: -1, view: '', driving: null });

  useEffect(() => {
    gl.shadowMap.autoUpdate = false;
    gl.shadowMap.needsUpdate = true; // initial bake (re-triggered on first frame too)
  }, [gl]);

  useFrame((_, dt) => {
    const { currentIndex, viewMode, isDriving } = useJourney.getState();
    const p = prev.current;
    if (currentIndex !== p.idx || viewMode !== p.view || isDriving !== p.driving) {
      // Movement started or changed — refresh shadows through the settle window.
      refresh.current = Math.max(refresh.current, 1.5);
      p.idx = currentIndex;
      p.view = viewMode;
      p.driving = isDriving;
    }
    if (isDriving) refresh.current = Math.max(refresh.current, 0.3);
    if (refresh.current > 0) {
      gl.shadowMap.needsUpdate = true;
      refresh.current -= dt;
    }
  });

  return null;
}

export default function Scene() {
  return (
    <>
      <Environment />
      <BackgroundCity />
      <Ground />

      <Suspense fallback={null}>
        <Stations />
      </Suspense>

      {/* <AmbientProps /> — uncomment to bring back trees / rocks / lampposts */}
      <Track />
      <Car />

      {/* Overview-only overhead stage beam over the current station.
          Flicker-safe by design: always mounted, shaders prewarmed during
          load, unlit additive meshes (no real light). See StageSpotlight.jsx. */}
      <StageSpotlight />

      <CameraRig />
      <ShadowControl />
      {ENABLE_POSTFX && <PostFX />}
    </>
  );
}
