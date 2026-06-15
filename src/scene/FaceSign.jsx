import { useMemo } from 'react';
import * as THREE from 'three';

// A flat neon "sign board" you can mount on a building's face — used to put
// custom lit text (e.g. "EDUCATION") onto a GLB whose own lettering is baked
// into its texture and can't be edited cleanly.
//
// It's fully self-contained: the text is drawn to a <canvas> (no font-CDN /
// troika dependency, so it can never hang on restricted networks), then shown
// on an unlit, tone-mapping-exempt plane so PostFX Bloom turns the bright
// glyphs into a real neon glow. An optional opaque backing panel sits just
// behind it to cover whatever is already painted on the wall.
//
// All placement is in the BUILDING's local space (this renders inside the
// model's tilt group), so the sign tilts and sits with the building.
// Configure everything per-station via `faceSign` in src/data/stations.js:
//   text      — the sign copy
//   position  — [x, y, z] on the building face. +z is toward the front face;
//               flip the z sign (and set rotation [0, Math.PI, 0]) if your
//               building's front turns out to be the other side.
//   rotation  — [x, y, z] radians (default faces +z)
//   width/height — sign size in scene units
//   color     — neon colour of the text (default purple to match the row)
//   backing   — false to drop the dark cover panel
export default function FaceSign({
  text = 'EDUCATION',
  position = [0, 2, 1],
  rotation = [0, 0, 0],
  width = 2.2,
  height = 0.52,
  color = '#b98cff',
  backing = true,
}) {
  const texture = useMemo(() => {
    const W = 1024;
    const H = Math.round((W * height) / width);
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    // Fit the text to the canvas width.
    const letterSpace = Math.round(H * 0.06);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let size = Math.round(H * 0.62);
    const fit = () => {
      ctx.font = `700 ${size}px "Helvetica Neue", Arial, sans-serif`;
      const spacing = letterSpace * (text.length - 1);
      return ctx.measureText(text).width + spacing;
    };
    while (fit() > W * 0.9 && size > 8) size -= 2;

    // Draw with tracking (manual letter spacing) + a soft glow halo so Bloom
    // has bright pixels to bloom from.
    const spacing = letterSpace * (text.length - 1);
    const totalW = ctx.measureText(text).width + spacing;
    let x = (W - totalW) / 2;
    const y = H / 2;
    ctx.shadowColor = color;
    ctx.shadowBlur = Math.round(H * 0.22);
    for (const ch of text) {
      const cw = ctx.measureText(ch).width;
      // glow pass (coloured) then a bright near-white core for a neon-tube look
      ctx.fillStyle = color;
      ctx.fillText(ch, x + cw / 2, y);
      ctx.shadowBlur = Math.round(H * 0.1);
      ctx.fillStyle = '#f3ecff';
      ctx.fillText(ch, x + cw / 2, y);
      ctx.shadowBlur = Math.round(H * 0.22);
      x += cw + letterSpace;
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    tex.needsUpdate = true;
    return tex;
  }, [text, color, width, height]);

  return (
    <group position={position} rotation={rotation}>
      {backing && (
        // Opaque dark panel that hides the building's existing baked lettering.
        // Sits a hair behind the text. Slightly larger than the text plane.
        <mesh position={[0, 0, -0.012]}>
          <planeGeometry args={[width * 1.04, height * 1.12]} />
          <meshStandardMaterial
            color="#23232b"
            roughness={0.8}
            metalness={0.1}
          />
        </mesh>
      )}
      {/* Neon text plane — unlit + toneMapped off so Bloom makes it glow. */}
      <mesh>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial
          map={texture}
          transparent
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
