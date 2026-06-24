import { useMemo } from 'react';
import * as THREE from 'three';
import { Stars } from '@react-three/drei';
import Meteors from './Meteors.jsx';
import { useDeviceProfile } from '../state/useDeviceProfile.js';

// Sky, fog, and base lighting. We use just enough light to read the
// low-poly forms — most of the visual oomph comes from emissive
// materials + bloom, not from physical lighting.

export default function Environment() {
  // Fog: starts well beyond the overview camera distance (~35-45) so the
  // active diorama always reads clearly. It only kicks in for the far
  // horizon and background props, giving depth without washing out
  // anything important.
  const fog = useMemo(() => new THREE.Fog('#01050d', 70, 155), []);

  // Background: a baked vertical gradient instead of a flat fill. A flat
  // `<color>` background reads as dead/monotone; a restrained cool-blue
  // gradient (lifted indigo up top → near-black navy at the bottom) gives the
  // sky depth and a focal centre without ever drawing attention to itself.
  // Three ingredients, all deliberately faint so the night mood is untouched:
  //   1. vertical linear gradient — the core lift.
  //   2. a soft radial glow low-centre behind the diorama — a gentle vignette
  //      that frames the active station.
  //   3. per-pixel dither noise — dark gradients band badly on most displays;
  //      a tiny amount of noise kills the colour-step artefacts.
  // Bottom stop is matched to the fog colour (#01050d) so the far horizon and
  // background props blend seamlessly into the sky. Set as scene.background
  // (a plain Texture renders as a stretched full-screen quad), so it never
  // interacts with fog or geometry and costs essentially nothing.
  const bgTexture = useMemo(() => {
    const w = 512;
    const h = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');

    // 1. Vertical gradient (top → bottom). Cool blue, very restrained.
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#0a1430'); // lifted indigo near the top
    grad.addColorStop(0.45, '#040c1c');
    grad.addColorStop(1, '#01050d'); // == fog colour at the horizon
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // 2. Soft radial glow low-centre — frames the diorama, fades to nothing.
    const glow = ctx.createRadialGradient(
      w * 0.5, h * 0.62, 0,
      w * 0.5, h * 0.62, h * 0.55,
    );
    glow.addColorStop(0, 'rgba(38, 66, 110, 0.16)');
    glow.addColorStop(1, 'rgba(38, 66, 110, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    // 3. Dither — ±3/255 noise to break up banding on smooth dark gradients.
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() - 0.5) * 6;
      d[i] += n;
      d[i + 1] += n;
      d[i + 2] += n;
    }
    ctx.putImageData(img, 0, 0);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }, []);

  // Performance tier scales the heaviest GPU items: the shadow map size, whether
  // the key light casts shadows at all, and the star count. The scene looks the
  // same — buildings, car, track, neon all stay — just cheaper to draw.
  const { tier } = useDeviceProfile();
  const castKeyShadow = tier !== 'low';
  const shadowMapSize = tier === 'high' ? 2048 : 1024;
  const starCount = tier === 'high' ? 4200 : 2200;

  return (
    <>
      {/* Background fog — gives depth and softens distant props */}
      <primitive attach="fog" object={fog} />
      <primitive attach="background" object={bgTexture} />

      {/* Stars — far-field, no interaction with bloom because they're tiny */}
      <Stars
        radius={86}
        depth={50}
        count={starCount}
        factor={2.5}
        saturation={0.6}
        fade
        speed={0}
      />

      {/* Stable shooting stars: visible enough to read without additive bloom. */}
      <Meteors />

      {/* --- Lighting: ONE unified rig for the whole scene ---
          Single cool-blue "moonlight" scheme. ALL local point lights
          (per-station keys, lamp posts, car lights, trophy accents) were
          removed — buildings now light themselves via emissive materials +
          bloom, and this rig provides the only real illumination:
            • ambient + hemisphere: a soft cool base so nothing goes pitch
              black, with a near-black ground tint to keep night depth.
            • one shadow-casting key directional: the "moon". One direction,
              one colour temperature, consistent across every station.
          Intensities are raised vs. the old multi-light setup to compensate
          for the ~16 deleted point lights. Side benefit: a near-empty
          per-pixel light loop, which was the main driver of Tour-mode
          black-frame flicker. */}
      <ambientLight intensity={0.22} color="#46639c" />
      <hemisphereLight args={['#6d8fc4', '#04081a', 0.5]} />
      <directionalLight
        position={[10, 18, 9]}
        intensity={2.7}
        color="#cfe0ff"
        castShadow={castKeyShadow}
        shadow-mapSize={[shadowMapSize, shadowMapSize]}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        // Anti-acne: the 2048 map spans a large area, so without a normal-based
        // bias the low texel density produces shimmering "shadow acne" on lit
        // surfaces — very visible up close in Tour mode, on every station.
        // normalBias offsets sampling along the surface normal to kill it
        // without the peter-panning a large depth bias would cause.
        shadow-bias={-0.00035}
        shadow-normalBias={0.04}
      />

      {/* Cool back-rim directional — NO shadow, so it's essentially free (one
          entry in the light loop, not the per-pixel point-light cost that
          drove the old flicker). It rakes the buildings from behind/opposite
          the key, lighting each silhouette's edge so the row reads with real
          depth instead of as flat cardboard cut-outs. This silhouette
          separation is one of the biggest "cinematic / premium" cues. */}
      <directionalLight
        position={[-14, 9, -12]}
        intensity={0.9}
        color="#8fb4ff"
      />

      {/* Faint WARM under-fill from the front so the cool shadow sides don't
          read as muddy grey-blue. Kept very low (0.2) so the neon night mood
          is untouched — it only adds a hint of temperature contrast, which is
          what makes a night render feel lit rather than flat. Lower/remove if
          you want a purely cool palette. */}
      <directionalLight
        position={[5, 3, 14]}
        intensity={0.2}
        color="#ffd6ad"
      />
    </>
  );
}
