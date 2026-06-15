import { useEffect, useRef, useState } from 'react';
import { stations } from '../data/stations.js';
import { useJourney } from '../state/useJourney.js';
import { useSwipe } from '../state/useSwipe.js';

// FinanceCoinOverlay — a full-screen "commemorative coin" experience for the
// Finance station, sibling to the Education book overlay. It is a plain
// HTML/CSS overlay (not part of the 3D canvas) so the metallic typography
// stays razor-sharp and the flip feels like a real coin landing.
//
// Behaviour
//   • Auto-opens when the visitor arrives at the Finance station in Tour view
//     (car stopped). Dismissed with × or ESC. Re-arms after leaving.
//   • You land on the "obverse" — the FNZ role coin. Flip forward (click the
//     coin, →, or the token rail) to reveal one coin minted per achievement;
//     flip back with ←. Quantified coins count up as they land.
//
// The flip is a "tip to edge" motion: the coin rotates to edge-on (where it
// is an invisible sliver), we swap in the next coin's face there, then it
// tips back up. Crucially the text NEVER passes the edge into the mirrored
// half-turn, so every face is always upright and readable — you never have to
// turn your head. (The earlier two-face spin showed the back face upside down;
// this avoids that entirely.)
//
// Content comes from the Finance station in src/data/stations.js (`role` and
// `coins`). Face 0 is the title coin; faces 1…N are the achievements.

const FIN_INDEX = Math.max(0, stations.findIndex((s) => s.id === 'skills'));
const STATION = stations[FIN_INDEX] ?? {};
const ROLE = STATION.role ?? {};
const COINS = STATION.coins ?? [];
const FACES = COINS.length + 1; // +1 for the leading title coin

const TIP_MS = 250; // tip-to-edge duration
const RISE_MS = 320; // tip-back-up duration

export default function FinanceCoinOverlay() {
  const viewMode = useJourney((s) => s.viewMode);
  const currentIndex = useJourney((s) => s.currentIndex);
  const isDriving = useJourney((s) => s.isDriving);
  const coinOpen = useJourney((s) => s.coinOpen);
  const openCoin = useJourney((s) => s.openCoin);
  const closeCoin = useJourney((s) => s.closeCoin);
  const setActiveCoin = useJourney((s) => s.setActiveCoin);

  const atFinance =
    viewMode === 'tour' && currentIndex === FIN_INDEX && !isDriving;

  // Auto-open once per arrival. `armed` stops it re-opening after a manual
  // close while still parked here.
  const armed = useRef(false);
  useEffect(() => {
    if (atFinance) {
      if (!armed.current) {
        armed.current = true;
        openCoin();
      }
    } else {
      armed.current = false;
      if (useJourney.getState().coinOpen) closeCoin();
    }
  }, [atFinance, openCoin, closeCoin]);

  const [idx, setIdx] = useState(0); // which coin faces the visitor
  const coinRef = useRef(null);
  const lock = useRef(false);

  // Always (re)open on the title coin, flat and upright.
  useEffect(() => {
    if (coinOpen) {
      setIdx(0);
      setActiveCoin(0);
      const el = coinRef.current;
      if (el) {
        el.style.transition = 'none';
        el.style.transform = 'rotateX(0deg)';
      }
    }
  }, [coinOpen, setActiveCoin]);

  const flip = (target, dir) => {
    if (target === idx || target < 0 || target >= FACES || lock.current) return;
    const el = coinRef.current;
    if (!el) {
      setIdx(target);
      setActiveCoin(target);
      return;
    }
    lock.current = true;
    // 1) Tip to edge-on (away for forward, toward for back).
    el.style.transition = `transform ${TIP_MS}ms cubic-bezier(0.5, 0, 0.9, 0.4)`;
    el.style.transform = `rotateX(${dir > 0 ? 90 : -90}deg)`;
    window.setTimeout(() => {
      // 2) While edge-on (invisible), swap the face and jump to the opposite
      //    edge with no transition, so it rises from the other side.
      setIdx(target);
      setActiveCoin(target);
      el.style.transition = 'none';
      el.style.transform = `rotateX(${dir > 0 ? -90 : 90}deg)`;
      void el.offsetWidth; // force reflow so the jump isn't animated
      // 3) Tip back up to flat — text upright the whole way.
      requestAnimationFrame(() => {
        el.style.transition = `transform ${RISE_MS}ms cubic-bezier(0.2, 0.8, 0.35, 1)`;
        el.style.transform = 'rotateX(0deg)';
      });
      window.setTimeout(() => {
        lock.current = false;
      }, RISE_MS + 30);
    }, TIP_MS);
  };

  const next = () => flip(Math.min(FACES - 1, idx + 1), 1);
  const prev = () => flip(Math.max(0, idx - 1), -1);
  const goTo = (t) => flip(t, t > idx ? 1 : -1);
  const close = () => closeCoin();

  // Touch: swipe left/right flips the coin forward/back (mirrors arrows).
  const swipe = useSwipe({ onLeft: next, onRight: prev });

  // Keyboard while open. The main Overlay suppresses its own nav keys whenever
  // coinOpen is true, so these never fight.
  useEffect(() => {
    if (!coinOpen) return undefined;
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
  }, [coinOpen, idx]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!coinOpen) return null;

  const canForward = idx < FACES - 1;
  const canBack = idx > 0;
  const progressPct = Math.round((idx / (FACES - 1)) * 100);

  return (
    <div className="coin" role="dialog" aria-modal="true" aria-label="Finance experience coin" {...swipe}>
      <div className="coin__backdrop" onClick={close} />

      <header className="coin__chrome">
        <div className="coin__title">
          <span className="coin__dot" aria-hidden />
          <span>
            Experience<span className="coin__sep"> · </span>
            <span className="coin__sub">
              {ROLE.title} · {ROLE.company}
            </span>
          </span>
        </div>
        <button className="coin__close" onClick={close} aria-label="Close (ESC)">
          <span aria-hidden>✕</span>
          <kbd>ESC</kbd>
        </button>
      </header>

      <div className="coin__stage">
        <div className="coin3d" ref={coinRef} onClick={canForward ? next : undefined}>
          <div className="coin-face">
            <CoinFace key={idx} item={idx} />
          </div>
        </div>
      </div>

      <nav className="coin__rail" aria-label="Coins">
        {Array.from({ length: FACES }, (_, i) => (
          <button
            key={i}
            className={`coin__token${i === idx ? ' is-active' : ''}`}
            onClick={() => goTo(i)}
            aria-label={i === 0 ? 'Title coin' : `Coin ${i}`}
            aria-current={i === idx}
          >
            {i === 0 ? '$' : i}
          </button>
        ))}
      </nav>

      <footer className="coin__hint">
        <button className="coin__nav" onClick={prev} disabled={!canBack} aria-label="Previous coin">
          ‹
        </button>
        <span className="coin__hint-text">
          {idx === 0
            ? 'Click the coin to flip'
            : idx >= FACES - 1
              ? 'The end · click ‹ to go back'
              : 'Click to flip · ESC to close'}
        </span>
        <button className="coin__nav" onClick={next} disabled={!canForward} aria-label="Next coin">
          ›
        </button>
        <div className="coin__progress" aria-hidden>
          <span style={{ width: `${progressPct}%` }} />
        </div>
      </footer>
    </div>
  );
}

// One coin face. item === 0 → the title coin; otherwise an achievement coin
// (coins[item - 1]).
function CoinFace({ item }) {
  if (item === 0) {
    return (
      <div className="coin-card coin-card--title">
        <div className="coin-crest" aria-hidden>$</div>
        <div className="coin-legend">{ROLE.company}</div>
        <h2 className="coin-role">{ROLE.title}</h2>
        <p className="coin-period">{ROLE.period}</p>
        <p className="coin-blurb">{ROLE.blurb}</p>
        <div className="coin-flip-hint">Flip ›</div>
      </div>
    );
  }

  const c = COINS[item - 1] ?? {};
  return (
    <div className="coin-card">
      <div className="coin-mint">
        {c.mint}
        <span className="coin-mint__n"> · {item} / {COINS.length}</span>
      </div>
      <div className="coin-glyph" aria-hidden>{c.glyph}</div>
      <h2 className="coin-card-title">{c.title}</h2>

      {c.metric != null ? (
        <div className="coin-metric">
          <span className="coin-metric__num">
            +<CountUp to={c.metric} />
            {c.suffix}
          </span>
          <span className="coin-metric__label">{c.metricLabel}</span>
        </div>
      ) : (
        <div className="coin-outcome">▲ {c.outcome}</div>
      )}

      <div className="coin-tags">
        {(c.tags ?? []).map((t) => (
          <span className="coin-tag" key={t}>
            {t}
          </span>
        ))}
      </div>

      <p className="coin-detail">{c.detail}</p>
    </div>
  );
}

// Eased count-up that runs on mount (the face remounts when its coin changes,
// so the number ticks up as the coin tips back up).
function CountUp({ to, duration = 900 }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration);
      const e = 1 - Math.pow(1 - p, 3);
      setV(Math.round(to * e));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, duration]);
  return <>{v}</>;
}
