import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { HalfFloatType } from 'three';
import { useJourney } from '../state/useJourney.js';
import { useDeviceProfile } from '../state/useDeviceProfile.js';

// Post-processing stack. The single biggest visual upgrade in the whole
// scene comes from Bloom: every `meshBasicMaterial` and `emissive` value
// > 1 gains a soft halo — the "expensive" neon look without complex shaders.
//
// macOS black-flicker notes (why this file looks minimal):
//   • ChromaticAberration was removed. On Apple/Metal WebGL it is the most
//     common cause of full-screen black flashing, and at our sub-0.0004
//     offsets it was visually imperceptible anyway — pure downside.
//   • frameBufferType is pinned to HalfFloatType so the HDR bloom buffer has
//     a stable, well-supported format on Apple GPUs (avoids the precision
//     edge cases that show up as flicker).
//   • Fewer passes = less per-frame GPU work = less chance of a frame
//     overrunning and triggering a context reset (which reads as black).
// If you still see flashing, the guaranteed-stable fallback is the
// ENABLE_POSTFX flag in Scene.jsx — set it to false to drop the composer
// entirely (the scene still renders, just without the halo glow).

export default function PostFX() {
  const viewMode = useJourney((s) => s.viewMode);
  const isTour = viewMode === 'tour';

  // On phones/tablets keep the neon bloom (it IS the premium look) but dial it
  // back a touch, and drop the extra Vignette pass — one fewer full-screen pass
  // per frame is meaningful headroom on a mobile GPU and helps avoid the
  // frame-overrun black flashes called out in the file header.
  const { tier } = useDeviceProfile();
  const mobile = tier !== 'high';
  const bloomIntensity = isTour ? (mobile ? 0.42 : 0.5) : mobile ? 0.6 : 0.82;

  return (
    <EffectComposer
      // Desktop: 4x MSAA on the composer buffer. Without it the thin neon
      // strips/text (esp. the Connect hub's sub-pixel glow lines) crawl and
      // shimmer as the camera drifts — perceived as "light jitter" up close.
      // Mobile keeps 0 to preserve GPU headroom (see header notes).
      multisampling={mobile ? 0 : 4}
      disableNormalPass
      frameBufferType={HalfFloatType}
    >
      <Bloom
        intensity={bloomIntensity}
        luminanceThreshold={isTour ? 0.86 : 0.72}
        luminanceSmoothing={0.54}
        mipmapBlur
      />
      {/* Tour only, desktop only. In overview the vignette darkened the corners
          over the flat night background, reading as a layered/graduated colour,
          so it's dropped there. On mobile it's dropped entirely to save a pass. */}
      {isTour && !mobile && <Vignette eskil={false} offset={0.26} darkness={0.44} />}
    </EffectComposer>
  );
}
