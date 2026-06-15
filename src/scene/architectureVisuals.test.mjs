import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getPremiumSkylineSpecs,
  getStationDressingSpecs,
} from './architectureVisuals.js';

test('premium skyline has layered varied silhouettes behind the station row', () => {
  const skyline = getPremiumSkylineSpecs();

  assert.equal(skyline.towers.length, 14);
  assert.ok(skyline.towers.every((tower) => tower.z <= -8.1));
  assert.ok(new Set(skyline.towers.map((tower) => tower.crown)).size >= 4);
  assert.ok(skyline.towers.some((tower) => tower.spire));
  assert.ok(skyline.towers.some((tower) => tower.setbacks.length >= 2));
  assert.ok(skyline.haze.width >= 44);
  assert.ok(skyline.windowSpecks.length >= 90);
});

test('station dressing keeps welcome clean and gives other stations architectural framing', () => {
  const welcome = getStationDressingSpecs({ id: 'welcome', index: 1, color: '#7dd3ff' });
  const finance = getStationDressingSpecs({ id: 'skills', index: 3, color: '#b6c6ff' });

  assert.deepEqual(welcome.structures, []);
  assert.deepEqual(welcome.pines, []);
  assert.equal(finance.structures.length, 6);
  assert.equal(finance.pines.length, 2);
  assert.ok(finance.structures.every((item) => item.height > 0.34));
  assert.ok(finance.structures.some((item) => item.crown === 'spire'));
});
