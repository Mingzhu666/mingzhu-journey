const SKYLINE_TOWERS = [
  { x: -18.4, z: -9.4, width: 0.92, depth: 0.56, height: 3.1, crown: 'needle', color: '#07111f', accent: '#7dd3ff', setbacks: [0.74, 0.52], spire: true },
  { x: -15.9, z: -8.8, width: 0.62, depth: 0.5, height: 2.0, crown: 'terrace', color: '#0a1628', accent: '#facc15', setbacks: [0.68], spire: false },
  { x: -13.7, z: -9.7, width: 1.05, depth: 0.62, height: 2.7, crown: 'lantern', color: '#081426', accent: '#38bdf8', setbacks: [0.72, 0.58], spire: false },
  { x: -11.2, z: -8.6, width: 0.52, depth: 0.46, height: 1.72, crown: 'flat', color: '#09172a', accent: '#93c5fd', setbacks: [], spire: false },
  { x: -8.9, z: -9.5, width: 0.82, depth: 0.54, height: 3.35, crown: 'deco', color: '#07111f', accent: '#fcd34d', setbacks: [0.76, 0.58, 0.42], spire: true },
  { x: -6.3, z: -8.7, width: 0.58, depth: 0.48, height: 2.18, crown: 'terrace', color: '#0b1830', accent: '#8db7ff', setbacks: [0.7], spire: false },
  { x: -3.6, z: -9.4, width: 0.96, depth: 0.6, height: 2.9, crown: 'lantern', color: '#081426', accent: '#a78bfa', setbacks: [0.78, 0.56], spire: false },
  { x: -0.9, z: -8.5, width: 0.48, depth: 0.42, height: 1.78, crown: 'flat', color: '#09172a', accent: '#60a5fa', setbacks: [], spire: false },
  { x: 1.7, z: -9.6, width: 0.78, depth: 0.55, height: 3.0, crown: 'needle', color: '#06111f', accent: '#7dd3ff', setbacks: [0.7, 0.5], spire: true },
  { x: 4.3, z: -8.7, width: 0.56, depth: 0.46, height: 1.92, crown: 'terrace', color: '#0a1628', accent: '#ff65f2', setbacks: [0.66], spire: false },
  { x: 6.9, z: -9.5, width: 1.04, depth: 0.62, height: 3.25, crown: 'deco', color: '#07111f', accent: '#fcd34d', setbacks: [0.8, 0.62, 0.48], spire: false },
  { x: 9.7, z: -8.6, width: 0.6, depth: 0.48, height: 2.18, crown: 'lantern', color: '#0b1830', accent: '#35b8ff', setbacks: [0.7], spire: false },
  { x: 12.3, z: -9.4, width: 0.84, depth: 0.56, height: 2.82, crown: 'needle', color: '#07111f', accent: '#8db7ff', setbacks: [0.72, 0.54], spire: true },
  { x: 15.2, z: -8.8, width: 0.68, depth: 0.5, height: 2.12, crown: 'terrace', color: '#09172a', accent: '#facc15', setbacks: [0.68], spire: false },
];

export function getPremiumSkylineSpecs() {
  return {
    haze: { width: 48, height: 7.2, position: [0, 2.3, -10.4] },
    towers: SKYLINE_TOWERS,
    windowSpecks: createWindowSpecks(SKYLINE_TOWERS),
  };
}

export function getStationDressingSpecs(station) {
  if (station.id === 'welcome') return { structures: [], pines: [] };

  const color = station.color ?? '#7dd3ff';
  const side = station.index % 2 === 0 ? -1 : 1;
  const structures = [
    { x: -1.54, z: -0.86, width: 0.28, depth: 0.24, height: 0.96, crown: 'terrace', color },
    { x: -1.26, z: 0.74, width: 0.22, depth: 0.2, height: 0.58, crown: 'flat', color },
    { x: 1.18, z: -0.9, width: 0.32, depth: 0.25, height: 1.18, crown: 'spire', color },
    { x: 1.48, z: 0.52, width: 0.22, depth: 0.19, height: 0.66, crown: 'lantern', color },
    { x: side * 0.86, z: -1.2, width: 0.24, depth: 0.2, height: 0.78, crown: 'deco', color },
    { x: side * 1.62, z: -0.12, width: 0.2, depth: 0.18, height: 0.64, crown: 'flat', color },
  ];

  return {
    structures,
    pines: [
      { x: -1.68, z: 1.08, height: 0.62 },
      { x: 1.58, z: 1.12, height: 0.58 },
    ],
  };
}

function createWindowSpecks(towers) {
  const out = [];
  for (const tower of towers) {
    const rows = Math.max(3, Math.floor(tower.height / 0.28));
    const cols = Math.max(1, Math.floor(tower.width / 0.18));
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        if ((row + col + Math.round(tower.x * 10)) % 3 === 0) continue;
        out.push({
          x: tower.x + (col - (cols - 1) / 2) * 0.16,
          y: 0.35 + row * 0.26,
          z: tower.z + tower.depth / 2 + 0.006,
          color: (row + col) % 5 === 0 ? '#fcd34d' : tower.accent,
          width: Math.min(0.08, tower.width * 0.22),
          height: 0.026,
          opacity: (row + col) % 5 === 0 ? 0.28 : 0.2,
        });
      }
    }
  }
  return out;
}
