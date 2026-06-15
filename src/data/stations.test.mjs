import test from 'node:test';
import assert from 'node:assert/strict';
import { stations } from './stations.js';

test('welcome station uses the exterior route model and has the interior room disabled', () => {
  const welcome = stations[0];

  assert.equal(welcome.id, 'welcome');
  assert.equal(welcome.model, '/models/monitor.min.glb');
  assert.equal(welcome.component, undefined);
  assert.equal(welcome.room, undefined); // interior welcome room temporarily disabled
});

test('volunteering station exposes three notice-board notes, each with three bullets', () => {
  const volunteering = stations.find((station) => station.id === 'achievements');

  // The neon tower was replaced by a normal matte GLB building (no component
  // override, web-optimised model). The notice-board content is unchanged.
  assert.equal(volunteering.component, undefined);
  assert.equal(volunteering.model, '/models/volunteer_building.v2.min.glb');
  assert.equal(volunteering.buildingGlow, false);
  assert.equal(volunteering.noticeBoard.length, 3);
  assert.deepEqual(
    volunteering.noticeBoard.map((note) => note.org),
    ['The Youngsters', 'Aspect', 'Lifeline Tasmania'],
  );
  for (const note of volunteering.noticeBoard) {
    assert.equal(note.bullets.length, 3);
    assert.ok(note.bullets.every((b) => typeof b === 'string' && b.length > 0));
  }
  assert.match(volunteering.noticeBoard[0].bullets[0], /repeat questions.*40%/i);
  assert.match(volunteering.noticeBoard[1].bullets[0], /weekly.*children/i);
  assert.match(volunteering.noticeBoard[2].bullets[0], /5\+.*<2 hrs\/week/i);
});
