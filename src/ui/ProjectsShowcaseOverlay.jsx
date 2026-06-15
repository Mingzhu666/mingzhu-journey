import { useEffect, useRef, useState } from 'react';
import { stations } from '../data/stations.js';
import { useJourney } from '../state/useJourney.js';
import { useSwipe } from '../state/useSwipe.js';

// ProjectsShowcaseOverlay — a full-screen holographic showcase for the
// Projects station, sibling to the Finance coin / Energy reactor / Education
// book. Plain HTML/CSS overlay (not the 3D canvas) so the typography and the
// bespoke per-project animations stay razor-sharp.
//
// Behaviour
//   • Auto-opens when the visitor arrives at the Projects station in Tour view
//     (car stopped). Dismissed with × or ESC. Re-arms after leaving.
//   • A carousel of four projects. Each switch plays a staggered, spring-eased
//     reveal; every project has its own animated "hero" visual on the right —
//     including a self-referential mini-map of THIS portfolio for the Journey
//     project. ← / → or the rail move between them.
//
// Content comes from the Projects station in src/data/stations.js (`projects`).

const PROJ_INDEX = Math.max(0, stations.findIndex((s) => s.id === 'experience'));
const STATION = stations[PROJ_INDEX] ?? {};
const PROJECTS = STATION.projects ?? [];
const N = PROJECTS.length;

// A winding "track" shared by the SVG path and the moving car (same coords).
const TRACK_D = 'M 14 120 C 52 144, 60 52, 104 66 C 142 78, 150 132, 188 108 C 212 93, 220 60, 230 50';
const STATION_DOTS = [
  [14, 120], [58, 84], [104, 66], [132, 92], [166, 116], [200, 92], [230, 50],
];

export default function ProjectsShowcaseOverlay() {
  const viewMode = useJourney((s) => s.viewMode);
  const currentIndex = useJourney((s) => s.currentIndex);
  const isDriving = useJourney((s) => s.isDriving);
  const showcaseOpen = useJourney((s) => s.showcaseOpen);
  const openShowcase = useJourney((s) => s.openShowcase);
  const closeShowcase = useJourney((s) => s.closeShowcase);
  const setActiveShowcase = useJourney((s) => s.setActiveShowcase);
  // Source of truth for which project is shown. Deep links (/PROJECTS/REDIS)
  // and browser back/forward set this via urlSync; the effect below slides the
  // showcase to match.
  const activeShowcaseIndex = useJourney((s) => s.activeShowcaseIndex);

  const atProjects =
    viewMode === 'tour' && currentIndex === PROJ_INDEX && !isDriving;

  const armed = useRef(false);
  useEffect(() => {
    if (atProjects) {
      if (!armed.current) {
        armed.current = true;
        openShowcase();
      }
    } else {
      armed.current = false;
      if (useJourney.getState().showcaseOpen) closeShowcase();
      // Rewind to the first project on leave, so a fresh drive-up arrival
      // starts at 01. A deep link sets activeShowcaseIndex AFTER this runs
      // (urlSync lives in the parent, whose effects fire after this child's),
      // so direct links to a specific project still win.
      if (useJourney.getState().activeShowcaseIndex !== 0) setActiveShowcase(0);
    }
  }, [atProjects, openShowcase, closeShowcase, setActiveShowcase]);

  const [idx, setIdx] = useState(0);
  const [dir, setDir] = useState(1);

  // Mirror the store's active project into the local display index. Because the
  // store is authoritative, external changes (deep link / back-forward) slide
  // the showcase here, while local flips (go()) already keep the two equal so
  // this no-ops for them.
  useEffect(() => {
    if (!showcaseOpen) return;
    if (activeShowcaseIndex !== idx) {
      setDir(activeShowcaseIndex > idx ? 1 : -1);
      setIdx(activeShowcaseIndex);
    }
  }, [activeShowcaseIndex, showcaseOpen, idx]);

  const go = (t) => {
    const target = ((t % N) + N) % N;
    if (target === idx) return;
    setDir(target > idx ? 1 : -1);
    setIdx(target);
    setActiveShowcase(target);
  };
  const next = () => go(idx + 1);
  const prev = () => go(idx - 1);
  const close = () => closeShowcase();

  // Touch: swipe left/right moves to the next/previous project (mirrors arrows).
  const swipe = useSwipe({ onLeft: next, onRight: prev });

  useEffect(() => {
    if (!showcaseOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      } else if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        next();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prev();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showcaseOpen, idx]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!showcaseOpen) return null;

  const p = PROJECTS[idx] ?? {};

  return (
    <div className="showcase" role="dialog" aria-modal="true" aria-label="Projects showcase" {...swipe}>
      <div className="showcase__backdrop" onClick={close} />

      <header className="showcase__chrome">
        <div className="showcase__title">
          <span className="showcase__dot" aria-hidden />
          <span>
            Experience<span className="showcase__sep"> · </span>
            <span className="showcase__sub">Selected Work</span>
          </span>
        </div>
        <button className="showcase__close" onClick={close} aria-label="Close (ESC)">
          <span aria-hidden>✕</span>
          <kbd>ESC</kbd>
        </button>
      </header>

      <div className="showcase__stage">
        <button className="showcase__arrow showcase__arrow--l" onClick={prev} aria-label="Previous project">‹</button>

        <article className="showcase__hero" key={idx} data-dir={dir}>
          <div className="showcase__info">
            <div className="showcase__meta showcase__rise" style={{ animationDelay: '0.04s' }}>
              PROJECT {p.num} <span className="showcase__meta-dim">/ {String(N).padStart(2, '0')}</span>
            </div>
            <h2 className="showcase__name showcase__rise" style={{ animationDelay: '0.10s' }}>{p.title}</h2>
            <div className="showcase__kind showcase__rise" style={{ animationDelay: '0.16s' }}>
              {p.kind}
              {p.note && <span className="showcase__note">{p.note}</span>}
            </div>
            <div className="showcase__stack showcase__rise" style={{ animationDelay: '0.22s' }}>
              {(p.stack ?? []).map((t) => (
                <span className="showcase__pill" key={t}>{t}</span>
              ))}
            </div>
            <ul className="showcase__highlights showcase__rise" style={{ animationDelay: '0.28s' }}>
              {(p.highlights ?? []).map((h, i) => (
                <li key={i}><span className="showcase__bullet" aria-hidden />{h}</li>
              ))}
            </ul>
          </div>

          <div className="showcase__visual showcase__rise" style={{ animationDelay: '0.18s' }}>
            <div className="showcase__screen">
              <ProjectVisual kind={p.visual} />
              <span className="showcase__scan" aria-hidden />
            </div>
          </div>
        </article>

        <button className="showcase__arrow showcase__arrow--r" onClick={next} aria-label="Next project">›</button>
      </div>

      <nav className="showcase__rail" aria-label="Projects">
        {PROJECTS.map((proj, i) => (
          <button
            key={proj.num ?? i}
            className={`showcase__thumb${i === idx ? ' is-active' : ''}`}
            onClick={() => go(i)}
            aria-current={i === idx}
          >
            <span className="showcase__thumb-num">{proj.num}</span>
            <span className="showcase__thumb-title">{proj.title}</span>
          </button>
        ))}
      </nav>

      <footer className="showcase__foot">
        <span className="showcase__hint">‹ › to move · ESC to close</span>
        <div className="showcase__progress" aria-hidden>
          <span style={{ width: `${Math.round(((idx + 1) / N) * 100)}%` }} />
        </div>
      </footer>
    </div>
  );
}

/* ─────────────────── Per-project hero visuals ─────────────────── */

function ProjectVisual({ kind }) {
  switch (kind) {
    case 'pte':
      return <PteVisual />;
    case 'journey':
      return <JourneyVisual />;
    case 'redis':
      return <RedisVisual />;
    case 'gpt':
      return <GptVisual />;
    default:
      return null;
  }
}

// PTE Master — an Apple-style app window: collapsible sidebar + category tiles.
function PteVisual() {
  const cats = ['Speaking', 'Writing', 'Reading', 'Listening'];
  return (
    <div className="pte">
      <div className="pte__bar">
        <span className="pte__dots"><i /><i /><i /></span>
        <span className="pte__lang"><b>English</b> / Chinese</span>
      </div>
      <div className="pte__app">
        <div className="pte__side">
          {['Dashboard', 'Practice', 'Mock Test', 'Progress'].map((r, i) => (
            <span key={r} className={`pte__nav${i === 1 ? ' on' : ''}`}><i className="pte__navdot" />{r}</span>
          ))}
        </div>
        <div className="pte__main">
          <div className="pte__grid">
            {cats.map((c, i) => (
              <div className="pte__tile" key={c} style={{ animationDelay: `${0.15 * i}s` }}>
                <span className="pte__tile-k">{c[0]}</span>
                <span className="pte__tile-l">{c}</span>
                <span className="pte__sheen" aria-hidden />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Mingzhu's Journey — a mini neon map of THIS portfolio, car driving the track.
function JourneyVisual() {
  return (
    <div className="journey">
      <svg viewBox="0 0 240 150" className="journey__svg" preserveAspectRatio="xMidYMid meet">
        {Array.from({ length: 26 }, (_, i) => (
          <circle
            key={i}
            cx={(i * 53) % 240}
            cy={(i * 37) % 150}
            r="0.7"
            className="journey__star"
            style={{ animationDelay: `${(i % 7) * 0.3}s` }}
          />
        ))}
        <path d={TRACK_D} className="journey__rail-glow" />
        <path d={TRACK_D} className="journey__rail" />
        {STATION_DOTS.map(([x, y], i) => (
          <g key={i}>
            <circle cx={x} cy={y} r="5.4" className="journey__halo" style={{ animationDelay: `${i * 0.28}s` }} />
            <circle cx={x} cy={y} r="2.4" className="journey__stop" />
          </g>
        ))}
      </svg>
      <span className="journey__car" style={{ offsetPath: `path('${TRACK_D}')`, WebkitOffsetPath: `path('${TRACK_D}')` }} aria-hidden />
      <span className="journey__tag">7 neon stations · live overlay</span>
    </div>
  );
}

// RedisLite — a RESP terminal with key cells lighting up + throughput.
function RedisVisual() {
  return (
    <div className="redis">
      <div className="redis__term">
        <div className="redis__line"><span className="redis__prompt">›</span> SET <b>user:1</b> "mz"</div>
        <div className="redis__reply">+OK</div>
        <div className="redis__line"><span className="redis__prompt">›</span> GET <b>user:1</b><span className="redis__cur" /></div>
      </div>
      <div className="redis__cells">
        {Array.from({ length: 24 }, (_, i) => (
          <span key={i} className="redis__cell" style={{ animationDelay: `${(i % 12) * 0.16}s` }} />
        ))}
      </div>
      <div className="redis__meter">
        <span className="redis__meter-l">THROUGHPUT</span>
        <span className="redis__bar"><i /></span>
      </div>
    </div>
  );
}

// NanoGPT — token attention lines + generated text typing out.
function GptVisual() {
  const tokens = ['To', 'be', 'or', 'not', 'to'];
  const xs = [26, 66, 106, 146, 186];
  const y = 34;
  const links = [];
  for (let i = 0; i < xs.length; i++) {
    for (let j = i + 1; j < xs.length; j++) {
      links.push([xs[i], xs[j], (links.length % 6) * 0.22]);
    }
  }
  return (
    <div className="gpt">
      <svg viewBox="0 0 212 120" className="gpt__svg" preserveAspectRatio="xMidYMid meet">
        {links.map(([x1, x2, d], i) => {
          const mx = (x1 + x2) / 2;
          const cy = y + 34 + Math.min(40, (x2 - x1) * 0.5);
          return (
            <path
              key={i}
              d={`M ${x1} ${y + 8} Q ${mx} ${cy} ${x2} ${y + 8}`}
              className="gpt__attn"
              style={{ animationDelay: `${d}s` }}
            />
          );
        })}
        {tokens.map((t, i) => (
          <g key={t}>
            <rect x={xs[i] - 16} y={y - 12} width="32" height="20" rx="5" className="gpt__tok" />
            <text x={xs[i]} y={y + 2} className="gpt__toktext">{t}</text>
          </g>
        ))}
      </svg>
      <div className="gpt__gen"><span className="gpt__caret">▌</span><span className="gpt__type">To be, or not to be…</span></div>
    </div>
  );
}
