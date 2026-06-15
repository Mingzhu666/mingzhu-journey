export function getOverviewCameraFrame({ width, height, fov }) {
  const aspect = width / height;
  const narrow = clamp((1 - aspect) / 0.5, 0, 1);
  const span = lerp(34, 18.5, narrow);
  const tiltRad = lerp(degToRad(11.5), degToRad(8.5), narrow);
  // Aim raised by 2 (was 1.95 / 0.95) so the whole diorama sits lower in the
  // frame — it was reading too high up. Raising the look target tilts the
  // camera up, which drops the subject down on screen.
  const lookY = lerp(3.95, 2.95, narrow);
  const lookZ = lerp(-0.1, 0.55, narrow);
  const distance = (span / 2 / (aspect * Math.tan(degToRad(fov) / 2))) * 0.94;

  return {
    span: round1(span),
    tiltRad,
    lookY: round2(lookY),
    lookZ: round2(lookZ),
    focusStrength: round2(lerp(0, 0.82, narrow)),
    distance,
    baseY: distance * Math.sin(tiltRad),
    baseZ: distance * Math.cos(tiltRad),
  };
}

function degToRad(value) {
  return (value * Math.PI) / 180;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

function round2(value) {
  return Math.round(value * 100) / 100;
}
