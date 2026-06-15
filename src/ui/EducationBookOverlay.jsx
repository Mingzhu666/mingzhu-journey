import { useEffect, useRef, useState } from 'react';
import { stations } from '../data/stations.js';
import { useJourney } from '../state/useJourney.js';
import { useSwipe } from '../state/useSwipe.js';

// EducationBookOverlay — a full-screen, realistic *heavy* hardcover book that
// takes over the screen at the Education station. It is a plain HTML/CSS
// overlay (not part of the 3D canvas) so the typography stays razor-sharp and
// the page-turn feels like a real book.
//
// Behaviour
//   • Auto-opens when the visitor arrives at the Education station in Tour
//     view (and the car has stopped driving). Dismissed with the × button or
//     ESC. Re-arms after leaving and coming back.
//   • Click the right page (or →) to turn forward, the left page (or ←) to
//     turn back. The book opens from its leather cover and closes onto the
//     back cover.
//
// Content: TWO postgraduate degrees, one spread each.
//   - leaf 0 front  = the leather cover
//   - spread 1      = Northeastern University · M.S. Computer Science
//   - spread 2      = University of Tasmania · M. IT & Systems (+ honours)
//   - last leaf back = the back cover

// Which station is "Education". Resolved by id so it survives reordering.
const EDU_INDEX = Math.max(
  0,
  stations.findIndex((s) => s.id === 'about'),
);

// The two degrees, in display order (most recent first). Each fills one
// two-page spread: the LEFT page is an engraved "plate" naming the degree +
// school, the RIGHT page lists the programme facts (and any honours).
const PROGRAMS = [
  {
    icon: 'grad',
    degree: 'Master of Science in Computer Science',
    school: 'Northeastern University',
    location: 'United States',
    period: 'Sep 2026 – Dec 2028',
    status: 'Upcoming',
    gpa: null,
    summary:
      'Graduate study in computer science at Northeastern — deepening systems, algorithms, and applied software engineering through the university’s renowned experiential co-op model.',
    honours: [],
  },
  {
    icon: 'grad',
    degree: 'Master of Information Technology and Systems',
    school: 'University of Tasmania',
    location: 'Australia',
    period: 'Jan 2018 – Dec 2019',
    status: 'Completed',
    gpa: '6.73 / 7.0',
    summary: null,
    honours: [
      'City of Hobart Student Ambassador',
      'International Student Shine Awards',
      "Vice-Chancellor's Leadership Award",
    ],
  },
];

// Build a leaf face that carries a degree plate / details story.
const plate = (i, n) => ({ variant: 'page', n, content: <DegreePlate program={PROGRAMS[i]} index={i + 1} /> });
const story = (i, n) => ({ variant: 'page', n, content: <DegreeStory program={PROGRAMS[i]} /> });

// The leaves of the book, in physical order. `variant` styles the face:
//   'cover' / 'back-cover' — dark-glass leather boards
//   'page'                 — holographic glass page (gilt-framed)
// 3 leaves → cover + 2 degree spreads + back cover.
const LEAVES = [
  { front: { variant: 'cover' }, back: plate(0, 1) },
  { front: story(0, 2), back: plate(1, 3) },
  { front: story(1, 4), back: { variant: 'back-cover' } },
];

const L = LEAVES.length; // number of leaves

export default function EducationBookOverlay() {
  const viewMode = useJourney((s) => s.viewMode);
  const currentIndex = useJourney((s) => s.currentIndex);
  const isDriving = useJourney((s) => s.isDriving);
  const bookOpen = useJourney((s) => s.bookOpen);
  const openBook = useJourney((s) => s.openBook);
  const closeBook = useJourney((s) => s.closeBook);

  // "Arrived at Education, parked, in Tour view."
  const atEducation =
    viewMode === 'tour' && currentIndex === EDU_INDEX && !isDriving;

  // Auto-open once per arrival. `armed` prevents re-opening after the visitor
  // manually closes the book while still parked at the station.
  const armed = useRef(false);
  useEffect(() => {
    if (atEducation) {
      if (!armed.current) {
        armed.current = true;
        openBook();
      }
    } else {
      armed.current = false;
      if (useJourney.getState().bookOpen) closeBook();
    }
  }, [atEducation, openBook, closeBook]);

  // `turned` = how many leaves have been flipped to the left (0 … L).
  const [turned, setTurned] = useState(0);

  // Always (re)open on the front cover.
  useEffect(() => {
    if (bookOpen) setTurned(0);
  }, [bookOpen]);

  const next = () => setTurned((t) => Math.min(L, t + 1));
  const prev = () => setTurned((t) => Math.max(0, t - 1));
  const close = () => closeBook();

  // Touch: swipe left turns forward, swipe right turns back (mirrors arrows).
  const swipe = useSwipe({ onLeft: next, onRight: prev });

  // Keyboard: ESC closes, arrows / space turn pages. Only while open — and the
  // main Overlay suppresses its own nav keys whenever bookOpen is true, so
  // these never fight each other.
  useEffect(() => {
    if (!bookOpen) return undefined;
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
  }, [bookOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Centering shift: closed → cover centered; open → spread centered; fully
  // turned → back cover centered. (See the component header / CSS for the
  // geometry behind these three positions.)
  const shift = turned === 0 ? '0%' : turned >= L ? '100%' : '50%';

  const showLeftStack = turned > 0;
  const showRightStack = turned < L;
  const progressPct = Math.round((turned / L) * 100);

  // Whether each side currently has a clickable affordance.
  const canForward = turned < L;
  const canBack = turned > 0;

  if (!bookOpen) return null;

  return (
    <div className="ebook" role="dialog" aria-modal="true" aria-label="Education book" {...swipe}>
      <div className="ebook__backdrop" onClick={close} />

      <header className="ebook__chrome">
        <div className="ebook__title">
          <span className="ebook__dot" aria-hidden />
          <span>
            Education<span className="ebook__sep"> · </span>
            <span className="ebook__sub">Academic Journey</span>
          </span>
        </div>
        <button className="ebook__close" onClick={close} aria-label="Close book (ESC)">
          <span aria-hidden>✕</span>
          <kbd>ESC</kbd>
        </button>
      </header>

      <div className="ebook__stage">
        <div className="ebook__book" style={{ transform: `translateX(${shift})` }}>
          {/* Hardcovers (leather boards) under the page block, peeking out. */}
          {showLeftStack && <div className="ebook__board ebook__board--left" />}
          {showRightStack && <div className="ebook__board ebook__board--right" />}

          {/* Thick page block — gives the book its heft (gilded fore-edges). */}
          {showLeftStack && <div className="ebook__block ebook__block--left" />}
          {showRightStack && <div className="ebook__block ebook__block--right" />}

          {/* The flipping leaves. */}
          {LEAVES.map((leaf, i) => {
            const flipped = i < turned;
            // The current spread shows leaf[turned].front (right page, or the
            // cover when turned===0) and leaf[turned-1].back (left page). Flag
            // those faces so their content can animate in on each turn.
            const frontActive = i === turned;
            const backActive = i === turned - 1;
            return (
              <div
                key={i}
                className={`ebook__leaf${flipped ? ' is-flipped' : ''}`}
                style={{
                  zIndex: flipped ? i : L - i,
                  transform: `rotateY(${flipped ? -180 : 0}deg)`,
                }}
              >
                <PageFace
                  side="front"
                  face={leaf.front}
                  active={frontActive}
                  onClick={canForward ? next : undefined}
                />
                <PageFace
                  side="back"
                  face={leaf.back}
                  active={backActive}
                  onClick={canBack ? prev : undefined}
                />
              </div>
            );
          })}

          {/* Soft crease shadow down the spine — only while a spread is open. */}
          {showLeftStack && showRightStack && <div className="ebook__gutter" aria-hidden />}
        </div>
      </div>

      <footer className="ebook__hint">
        <button className="ebook__nav" onClick={prev} disabled={!canBack} aria-label="Previous page">
          ‹
        </button>
        <span className="ebook__hint-text">
          {turned === 0
            ? 'Click the cover to open'
            : turned >= L
              ? 'The end · click ‹ to go back'
              : 'Click the page to turn · ESC to close'}
        </span>
        <button className="ebook__nav" onClick={next} disabled={!canForward} aria-label="Next page">
          ›
        </button>
        <div className="ebook__progress" aria-hidden>
          <span style={{ width: `${progressPct}%` }} />
        </div>
      </footer>
    </div>
  );
}

// A single page face. Front faces look toward the reader when the leaf rests
// on the right; back faces are revealed once the leaf is turned left.
function PageFace({ side, face, onClick, active }) {
  const variant = face?.variant ?? 'page';
  const isCover = variant === 'cover' || variant === 'back-cover';

  return (
    <div
      className={`ebook__face ebook__face--${side} ebook__face--${variant}${
        onClick ? ' is-clickable' : ''
      }${active ? ' is-active' : ''}`}
      onClick={
        onClick
          ? (e) => {
              e.stopPropagation();
              onClick();
            }
          : undefined
      }
    >
      {variant === 'cover' && (
        <div className="ebook__cover-art">
          <div className="ebook__cover-frame" />
          <div className="ebook__crest" aria-hidden>
            <GradCap />
          </div>
          <h1 className="ebook__cover-title">Education</h1>
          <p className="ebook__cover-line">Academic Journey</p>
          <p className="ebook__cover-sub">CS Master&apos;s Degree</p>
          <div className="ebook__cover-open">Open ›</div>
        </div>
      )}

      {variant === 'back-cover' && (
        <div className="ebook__cover-art ebook__cover-art--back">
          <div className="ebook__cover-frame" />
          <div className="ebook__monogram" aria-hidden>
            M
          </div>
        </div>
      )}

      {variant === 'page' && (
        <div className="ebook__page-art">
          {face?.content ?? <div className="ebook__page-blank" aria-hidden />}
          {face?.n != null && <div className="ebook__folio">{face.n}</div>}
        </div>
      )}

      {!isCover && <div className="ebook__page-shade" aria-hidden />}
    </div>
  );
}

/* ─────────────────── Degree pages ─────────────────── */

// Left page: an engraved plate naming the degree and the school.
function DegreePlate({ program, index }) {
  return (
    <div className="award award--plate">
      <div className="award__index">No. {String(index).padStart(2, '0')}</div>
      <Seal icon={program.icon} />
      <h2 className="award__title">{program.degree}</h2>
      <div className="award__issuer">{program.school}</div>
      <div className="award__badge">{program.location}</div>
    </div>
  );
}

// Right page: the programme facts (duration / GPA / location) and, when there
// are any, the honours earned during the degree.
function DegreeStory({ program }) {
  return (
    <div className="award award--story">
      <div className="award__kicker">Programme</div>

      <dl className="degree__facts">
        <div className="degree__fact">
          <dt>Duration</dt>
          <dd>{program.period}</dd>
        </div>
        {program.gpa && (
          <div className="degree__fact degree__fact--gpa">
            <dt>GPA</dt>
            <dd>{program.gpa}</dd>
          </div>
        )}
        <div className="degree__fact">
          <dt>Location</dt>
          <dd>{program.location}</dd>
        </div>
      </dl>

      {program.summary && <p className="award__citation">{program.summary}</p>}

      {program.honours?.length > 0 && (
        <>
          <div className="award__kicker degree__honours-kicker">Honours &amp; Awards</div>
          <ul className="award__points">
            {program.honours.map((h, i) => (
              <li key={i}>
                <svg className="award__pt-mark" viewBox="0 0 16 16" aria-hidden>
                  <path d="M3 8.5 L6.5 12 L13 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {h}
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="award__badge award__badge--year">{program.status}</div>
    </div>
  );
}

// A small graduation-cap mark used in the cover crest.
function GradCap() {
  return (
    <svg viewBox="0 0 100 100" className="ebook__crest-svg" aria-hidden>
      <polygon points="50,30 76,41 50,52 24,41" fill="currentColor" />
      <path d="M36 46 V57 Q50 65 64 57 V46" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M76 41 V60" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" />
      <circle cx="76" cy="62.5" r="3.2" fill="currentColor" />
    </svg>
  );
}

// A circular medallion: gilt ring, milled edge, ribbon tails, and a centred
// engraved glyph. A slow shine sweeps across it.
function Seal({ icon }) {
  const ticks = [];
  for (let i = 0; i < 36; i += 1) {
    const a = (Math.PI * 2 * i) / 36;
    const r1 = 31.5;
    const r2 = 34;
    ticks.push(
      <line
        key={i}
        x1={(50 + Math.cos(a) * r1).toFixed(2)}
        y1={(40 + Math.sin(a) * r1).toFixed(2)}
        x2={(50 + Math.cos(a) * r2).toFixed(2)}
        y2={(40 + Math.sin(a) * r2).toFixed(2)}
      />,
    );
  }
  return (
    <div className="award__seal">
      <svg viewBox="0 0 100 100" className="award__seal-svg" aria-hidden>
        <g className="award__ribbon">
          <path d="M42 64 L35 92 L41 88 L46 92 L48 66 Z" />
          <path d="M58 64 L65 92 L59 88 L54 92 L52 66 Z" />
        </g>
        <circle className="award__seal-ring" cx="50" cy="40" r="30" />
        <g className="award__ticks">{ticks}</g>
        <circle className="award__seal-ring2" cx="50" cy="40" r="24" />
        <g className="award__glyph">{GLYPH[icon] ?? null}</g>
      </svg>
      <span className="award__seal-shine" aria-hidden />
    </div>
  );
}

// Build the points string for a regular star/sparkle centred at (cx, cy).
function polarPoints(cx, cy, spikes, outer, inner) {
  const pts = [];
  for (let i = 0; i < spikes * 2; i += 1) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI / spikes) * i - Math.PI / 2;
    pts.push(`${(cx + Math.cos(a) * r).toFixed(2)},${(cy + Math.sin(a) * r).toFixed(2)}`);
  }
  return pts.join(' ');
}

// Centre glyphs.
const GLYPH = {
  grad: (
    <g>
      <polygon className="fill" points="50,29 71,38 50,47 29,38" />
      <path className="ln" d="M39 43 V51.5 Q50 58 61 51.5 V43" />
      <path className="ln" d="M71 38 V53" />
      <circle className="fill" cx="71" cy="54.6" r="2.4" />
    </g>
  ),
  shine: (
    <g>
      <polygon className="fill" points={polarPoints(50, 40, 4, 14, 3.6)} />
      <circle className="fill" cx="50" cy="40" r="2.6" />
    </g>
  ),
};
