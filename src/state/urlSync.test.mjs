import test from 'node:test';
import assert from 'node:assert/strict';
import { stations } from '../data/stations.js';
import { indexForPath, projectIndexForPath, pathForState } from './urlSync.js';

// The deep-link slug map the tour exposes. Order matches the 7 stations.
const EXPECTED = [
  { id: 'welcome', slug: 'welcome' },
  { id: 'about', slug: 'EDUCATION' },
  { id: 'skills', slug: 'FNZ' },
  { id: 'projects', slug: 'AEMO' },
  { id: 'experience', slug: 'PROJECTS' },
  { id: 'achievements', slug: 'Volunteer' },
  { id: 'contact', slug: 'CONNECT' },
];

const PROJECTS_INDEX = stations.findIndex((s) => s.id === 'experience');

// The 4 projects inside the Projects building, in showcase order.
const EXPECTED_PROJECTS = [
  { title: 'PTE Master', slug: 'PTE' },
  { title: "Mingzhu's Journey", slug: 'JOURNEY' },
  { title: 'RedisLite', slug: 'REDIS' },
  { title: 'NanoGPT', slug: 'NANOGPT' },
];

// Helper: build the slice of journey state that pathForState reads.
const tour = (currentIndex, extra = {}) => ({
  viewMode: 'tour',
  currentIndex,
  showcaseOpen: false,
  activeShowcaseIndex: 0,
  ...extra,
});

test('every station declares the expected slug, in order', () => {
  assert.equal(stations.length, EXPECTED.length);
  EXPECTED.forEach(({ id, slug }, i) => {
    assert.equal(stations[i].id, id, `station ${i} id`);
    assert.equal(stations[i].slug, slug, `station ${i} slug`);
  });
});

test('every project declares the expected slug, in order', () => {
  const projects = stations[PROJECTS_INDEX].projects;
  assert.equal(projects.length, EXPECTED_PROJECTS.length);
  EXPECTED_PROJECTS.forEach(({ title, slug }, i) => {
    assert.equal(projects[i].title, title, `project ${i} title`);
    assert.equal(projects[i].slug, slug, `project ${i} slug`);
  });
});

test('station and project slugs are each unique', () => {
  const slugs = stations.map((s) => s.slug.toLowerCase());
  assert.equal(new Set(slugs).size, slugs.length);
  const pslugs = stations[PROJECTS_INDEX].projects.map((p) => p.slug.toLowerCase());
  assert.equal(new Set(pslugs).size, pslugs.length);
});

test('indexForPath maps each station slug to its index (incl. 2-segment paths)', () => {
  EXPECTED.forEach(({ slug }, i) => {
    assert.equal(indexForPath(`/${slug}`), i);
  });
  // A project sub-route still resolves its building from the first segment.
  assert.equal(indexForPath('/PROJECTS/REDIS'), PROJECTS_INDEX);
});

test('indexForPath is case-insensitive and tolerates trailing slashes', () => {
  assert.equal(indexForPath('/fnz'), 2);
  assert.equal(indexForPath('/FNZ/'), 2);
  assert.equal(indexForPath('/education'), 1);
  assert.equal(indexForPath('/VOLUNTEER'), 5);
});

test('home route and unknown slugs return null (→ overview)', () => {
  assert.equal(indexForPath('/'), null);
  assert.equal(indexForPath(''), null);
  assert.equal(indexForPath('/does-not-exist'), null);
});

test('projectIndexForPath maps each project sub-slug to its index', () => {
  EXPECTED_PROJECTS.forEach(({ slug }, i) => {
    assert.equal(projectIndexForPath(`/PROJECTS/${slug}`), i);
  });
});

test('projectIndexForPath is case-insensitive', () => {
  assert.equal(projectIndexForPath('/projects/redis'), 2);
  assert.equal(projectIndexForPath('/PROJECTS/nanogpt'), 3);
});

test('projectIndexForPath returns null without a (valid) sub-slug or wrong building', () => {
  assert.equal(projectIndexForPath('/PROJECTS'), null);
  assert.equal(projectIndexForPath('/PROJECTS/nope'), null);
  assert.equal(projectIndexForPath('/FNZ/REDIS'), null); // sub-slug only valid under PROJECTS
});

test('pathForState round-trips tour stations back to their slug', () => {
  EXPECTED.forEach(({ slug }, i) => {
    const path = pathForState(tour(i));
    assert.equal(path, `/${slug}`);
    assert.equal(indexForPath(path), i); // round-trip
  });
});

test('pathForState appends the active project when the showcase is open', () => {
  EXPECTED_PROJECTS.forEach(({ slug }, i) => {
    const path = pathForState(
      tour(PROJECTS_INDEX, { showcaseOpen: true, activeShowcaseIndex: i }),
    );
    assert.equal(path, `/PROJECTS/${slug}`);
    // round-trip both halves
    assert.equal(indexForPath(path), PROJECTS_INDEX);
    assert.equal(projectIndexForPath(path), i);
  });
});

test('pathForState gives the bare building path when the showcase is closed', () => {
  assert.equal(
    pathForState(tour(PROJECTS_INDEX, { showcaseOpen: false, activeShowcaseIndex: 2 })),
    '/PROJECTS',
  );
});

test('overview (and any non-tour mode) maps to the home route', () => {
  assert.equal(pathForState({ viewMode: 'overview', currentIndex: 0 }), '/');
  assert.equal(pathForState({ viewMode: 'overview', currentIndex: 3 }), '/');
});
