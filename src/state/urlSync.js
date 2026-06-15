import { useEffect } from 'react';
import { stations } from '../data/stations.js';
import { useJourney } from './useJourney.js';

// URL deep-linking for the journey.
//
// Each building gets its own clean URL so visitors can bookmark, share, and
// land directly on a station — and the Projects building goes one level
// deeper, giving every project its own sub-route:
//
//   /                  → overview (home — all buildings framed at once)
//   /welcome           → station 1, Tour view
//   /EDUCATION         → station 2
//   /FNZ               → station 3 (Finance · FNZ)
//   /AEMO              → station 4 (Energy · AEMO)
//   /PROJECTS          → station 5 (defaults to the first project)
//   /PROJECTS/PTE      → station 5, PTE Master
//   /PROJECTS/JOURNEY  → station 5, Mingzhu's Journey
//   /PROJECTS/REDIS    → station 5, RedisLite
//   /PROJECTS/NANOGPT  → station 5, NanoGPT
//   /Volunteer         → station 6
//   /CONNECT           → station 7
//
// The slugs live on the stations (and on each project) in
// src/data/stations.js, so this module is data-driven: add/rename a slug
// there and the routing follows.
//
// Two directions are kept in sync:
//   • URL → state: on first load and on browser back/forward (popstate), the
//     path picks the station + Tour view (or overview for '/'), and a project
//     sub-slug selects the active project in the showcase.
//   • state → URL: whenever the journey moves (a new station, toggling
//     overview/tour, or flipping to another project), the address bar updates.
//
// We use the History API directly (pushState/replaceState) — no router
// dependency. For direct visits to /FNZ or /PROJECTS/REDIS to work, the static
// host must fall back to index.html (see vercel.json and public/_redirects).

// --- slug ⇄ index maps (built once from the station data) -------------------
const indexBySlug = new Map();
stations.forEach((station, i) => {
  if (station.slug) indexBySlug.set(station.slug.toLowerCase(), i);
});

// The Projects building and its per-project slug → index map.
const PROJECTS_INDEX = stations.findIndex((s) => s.id === 'experience');
const PROJECTS_SLUG = (stations[PROJECTS_INDEX]?.slug ?? '').toLowerCase();
const projectIndexBySlug = new Map();
(stations[PROJECTS_INDEX]?.projects ?? []).forEach((proj, i) => {
  if (proj.slug) projectIndexBySlug.set(proj.slug.toLowerCase(), i);
});

// Split a pathname into decoded, non-empty segments. '/PROJECTS/REDIS' →
// ['PROJECTS', 'REDIS']; '/' → [].
function segments(pathname) {
  let p = pathname || '/';
  try {
    p = decodeURIComponent(p);
  } catch {
    // Malformed %-escape — fall back to the raw string.
  }
  return p.split('/').map((s) => s.trim()).filter(Boolean);
}

// URL → station index. Returns null for the home/overview route or an unknown
// first segment (caller treats both as "show the overview").
export function indexForPath(pathname) {
  const segs = segments(pathname);
  if (segs.length === 0) return null;
  const slug = segs[0].toLowerCase();
  return indexBySlug.has(slug) ? indexBySlug.get(slug) : null;
}

// URL → project index, only meaningful under the Projects building
// (/PROJECTS/<proj>). Returns null when there is no (recognised) project
// sub-slug.
export function projectIndexForPath(pathname) {
  const segs = segments(pathname);
  if (segs.length < 2) return null;
  if (segs[0].toLowerCase() !== PROJECTS_SLUG) return null;
  const pslug = segs[1].toLowerCase();
  return projectIndexBySlug.has(pslug) ? projectIndexBySlug.get(pslug) : null;
}

// State → the path it should produce. Overview (and any non-tour mode) maps to
// the home route; a tour station maps to its slug. While the Projects showcase
// is open, the active project is appended as a second segment.
export function pathForState(state) {
  const { viewMode, currentIndex, showcaseOpen, activeShowcaseIndex } = state;
  if (viewMode !== 'tour') return '/';
  const station = stations[currentIndex];
  if (!station?.slug) return '/';
  if (currentIndex === PROJECTS_INDEX && showcaseOpen) {
    const proj = (station.projects ?? [])[activeShowcaseIndex];
    if (proj?.slug) return `/${station.slug}/${proj.slug}`;
  }
  return `/${station.slug}`;
}

// The current address-bar path, decoded and stripped of a trailing slash so it
// compares cleanly against pathForState's output.
function currentPath() {
  let p = window.location.pathname || '/';
  try {
    p = decodeURIComponent(p);
  } catch {
    /* keep raw */
  }
  const trimmed = p.replace(/\/+$/g, '');
  return trimmed === '' ? '/' : trimmed;
}

// Guard so writing the URL in response to a popstate/initial read doesn't loop
// back into another history entry.
let applyingFromUrl = false;

// React hook: mount once (e.g. in App) to enable deep-linking.
export function useUrlSync() {
  const goTo = useJourney((s) => s.goTo);
  const setViewMode = useJourney((s) => s.setViewMode);
  const setActiveShowcase = useJourney((s) => s.setActiveShowcase);

  // URL → state, on first load and on browser back/forward.
  useEffect(() => {
    const applyFromUrl = () => {
      applyingFromUrl = true;
      try {
        const idx = indexForPath(window.location.pathname);
        if (idx == null) {
          setViewMode('overview');
        } else {
          // Select the deep-linked project BEFORE the station opens, so the
          // showcase opens straight on it (see ProjectsShowcaseOverlay).
          if (idx === PROJECTS_INDEX) {
            const proj = projectIndexForPath(window.location.pathname);
            setActiveShowcase(proj ?? 0);
          }
          goTo(idx);
          setViewMode('tour');
        }
      } finally {
        applyingFromUrl = false;
      }
    };

    applyFromUrl(); // honour the URL the visitor arrived on
    window.addEventListener('popstate', applyFromUrl);
    return () => window.removeEventListener('popstate', applyFromUrl);
  }, [goTo, setViewMode, setActiveShowcase]);

  // state → URL, whenever the journey moves.
  useEffect(() => {
    const write = (state) => {
      if (applyingFromUrl) return; // change came FROM the URL — don't echo it back
      const desired = pathForState(state);
      if (desired === currentPath()) return;
      window.history.pushState(null, '', desired);
      syncTitle(state);
    };

    // Reflect the very first state too (e.g. so a fresh '/' load gets a title),
    // then keep it in sync.
    syncTitle(useJourney.getState());
    const unsubscribe = useJourney.subscribe(write);
    return unsubscribe;
  }, []);
}

// Keep the browser tab title in step with the current building / project. Nice
// for bookmarks and shared links.
const BASE_TITLE = 'Mingzhu — Interactive Portfolio';
function syncTitle(state) {
  if (typeof document === 'undefined') return;
  const { viewMode, currentIndex, showcaseOpen, activeShowcaseIndex } = state;
  const station = stations[currentIndex];
  if (viewMode === 'tour' && station) {
    if (currentIndex === PROJECTS_INDEX && showcaseOpen) {
      const proj = (station.projects ?? [])[activeShowcaseIndex];
      if (proj?.title) {
        document.title = `${proj.title} — Mingzhu`;
        return;
      }
    }
    document.title = `${station.title} — Mingzhu`;
  } else {
    document.title = BASE_TITLE;
  }
}
