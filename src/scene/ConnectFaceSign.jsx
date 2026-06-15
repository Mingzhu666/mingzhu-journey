import { useMemo } from 'react';
import * as THREE from 'three';

// Official GitHub "Octocat" mark (simple-icons path, 24×24 viewBox). Stroked as
// line-art to match the other outline icons on the panel.
const GITHUB_PATH =
  'M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12';

// A multi-row neon "info panel" mounted on the Connect building's face — the
// same idea as FaceSign.jsx (canvas → unlit, tone-mapping-exempt plane so PostFX
// Bloom turns the bright glyphs into neon), but laid out as a titled list with
// an icon + label + sub-label per row. Recreates the old Connect-hub panel
// (CONNECT HUB / RESUME / GITHUB / LINKEDIN / EMAIL) on the new GLB, which ships
// no baked lettering of its own. Styled to match the station's neon row.
//
// Placement is in the BUILDING's local space (renders inside the model's tilt
// group), so it tilts and sits with the building. Configure per-station via
// `connectPanel` in src/data/stations.js:
//   title      — header copy ("CONNECT HUB")
//   rows       — [{ icon, label, sub }]  icon ∈ doc|github|linkedin|mail
//   position   — [x, y, z] on the face (+z = toward the front/viewer face)
//   rotation   — [x, y, z] radians (default faces +z; use [0, Math.PI, 0] for back)
//   width/height — panel size in scene units
//   color      — neon text colour (default light blue to match the Connect row)
//   backing    — false to drop the dark cover panel
export default function ConnectFaceSign({
  title = 'CONNECT HUB',
  rows = [
    { icon: 'doc', label: 'RESUME', sub: 'Download PDF' },
    { icon: 'github', label: 'GITHUB', sub: 'View Profile' },
    { icon: 'linkedin', label: 'LINKEDIN', sub: 'View Profile' },
    { icon: 'mail', label: 'EMAIL', sub: 'Send Email' },
  ],
  position = [0, 3.0, 2.25],
  rotation = [0, 0, 0],
  width = 2.4,
  height = 3.2,
  color = '#cfe6ff',
  glowColor = '#5aa0ff',
  subColor = '#9cc4ec',
  backing = true,
}) {
  const texture = useMemo(() => {
    const W = 720;
    const H = Math.round((W * height) / width);
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    const rr = (x, y, w, h, r) => {
      const rad = Math.min(r, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(x + rad, y);
      ctx.arcTo(x + w, y, x + w, y + h, rad);
      ctx.arcTo(x + w, y + h, x, y + h, rad);
      ctx.arcTo(x, y + h, x, y, rad);
      ctx.arcTo(x, y, x + w, y, rad);
      ctx.closePath();
    };

    const font = (px, weight = 700) =>
      `${weight} ${px}px "Helvetica Neue", Arial, sans-serif`;

    // ---- Title ---- (lighter weight + generous tracking reads as a calm
    // header rather than a heavy slab, so it sits in harmony with the rows)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = Math.round(H * 0.024);
    ctx.fillStyle = color;
    // Title centred slightly right of the panel midline so it lines up over the
    // (icon + label) rows below, which are shifted right of centre.
    const titleCx = W * 0.55;
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${Math.round(W * 0.016)}px`;
    ctx.font = font(Math.round(W * 0.064), 600);
    ctx.fillText(title, titleCx, H * 0.105);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';

    // underline — short accent centred under the title
    ctx.shadowBlur = Math.round(H * 0.012);
    ctx.strokeStyle = glowColor;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(titleCx - W * 0.22, H * 0.17);
    ctx.lineTo(titleCx + W * 0.22, H * 0.17);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // ---- Rows ----
    const n = rows.length;
    const top = H * 0.29;
    const rowH = (H * 0.93 - top) / n;
    const iconCx = W * 0.34;
    const textX = W * 0.49;
    const iconR = Math.round(W * 0.062);

    const drawIcon = (kind, cx, cy) => {
      const s = iconR;
      const L = cx - s, R = cx + s, T = cy - s, B = cy + s;
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 4;
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = Math.round(H * 0.018);
      if (kind === 'doc') {
        rr(L, T, 2 * s, 2 * s, 8);
        ctx.stroke();
        ctx.lineWidth = 4;
        for (let i = 0; i < 3; i++) {
          const yy = T + s * 0.6 + i * s * 0.55;
          ctx.beginPath();
          ctx.moveTo(L + s * 0.4, yy);
          ctx.lineTo(R - s * 0.4 - (i === 2 ? s * 0.3 : 0), yy);
          ctx.stroke();
        }
      } else if (kind === 'github') {
        // Authentic Octocat mark, stroked to match the outline icon style.
        const box = 2 * s;
        const sc = box / 24;
        ctx.save();
        ctx.translate(cx - s, cy - s);
        ctx.scale(sc, sc);
        ctx.lineWidth = 0.95;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.strokeStyle = color;
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = (H * 0.016) / sc;
        ctx.stroke(new Path2D(GITHUB_PATH));
        ctx.restore();
      } else if (kind === 'linkedin') {
        rr(L, T, 2 * s, 2 * s, 10);
        ctx.stroke();
        ctx.shadowBlur = Math.round(H * 0.01);
        ctx.font = font(Math.round(s * 1.2), 700);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('in', cx, cy + s * 0.06);
      } else if (kind === 'mail') {
        rr(L, T + s * 0.2, 2 * s, 2 * s - s * 0.4, 8);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(L + 3, T + s * 0.3);
        ctx.lineTo(cx, cy + s * 0.15);
        ctx.lineTo(R - 3, T + s * 0.3);
        ctx.stroke();
      }
    };

    rows.forEach((row, i) => {
      const cy = top + i * rowH + rowH * 0.45;
      drawIcon(row.icon, iconCx, cy);
      // label
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = Math.round(H * 0.022);
      ctx.fillStyle = color;
      ctx.font = font(Math.round(W * 0.072));
      ctx.fillText(row.label, textX, cy - rowH * 0.13);
      // sub-label
      ctx.shadowBlur = Math.round(H * 0.008);
      ctx.fillStyle = subColor;
      ctx.font = font(Math.round(W * 0.038), 400);
      ctx.fillText(row.sub, textX + 2, cy + rowH * 0.2);
    });

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    tex.needsUpdate = true;
    return tex;
  }, [title, rows, color, glowColor, subColor, width, height]);

  return (
    <group position={position} rotation={rotation}>
      {backing && (
        <mesh position={[0, 0, -0.012]}>
          <planeGeometry args={[width * 1.02, height * 1.02]} />
          <meshStandardMaterial
            color="#08142c"
            transparent
            opacity={0.82}
            roughness={0.85}
            metalness={0.1}
          />
        </mesh>
      )}
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
