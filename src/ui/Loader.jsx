import { useEffect, useState } from 'react';
import { useProgress } from '@react-three/drei';

// Loading screen that fades out as soon as either condition is true:
//   • drei reports loading is done (progress >= 100, nothing active), or
//   • nothing asynchronous is being tracked (total === 0), or
//   • a hard timeout elapses (so a stalled font fetch can't trap the UI).
//
// The hard timeout is the most important safety net: our scene is mostly
// procedural so `useProgress` may never report any items — without the
// timeout the loader would sit on screen forever.

const HARD_TIMEOUT_MS = 1500;

export default function Loader({ onHidden = () => {} }) {
  const { progress, active, total } = useProgress();
  const [show, setShow] = useState(true);
  const [fade, setFade] = useState(false);

  // Hard timeout fallback — fires regardless of asset state.
  useEffect(() => {
    const fadeAt = setTimeout(() => setFade(true), HARD_TIMEOUT_MS);
    const hideAt = setTimeout(() => setShow(false), HARD_TIMEOUT_MS + 500);
    return () => {
      clearTimeout(fadeAt);
      clearTimeout(hideAt);
    };
  }, []);

  useEffect(() => {
    if (!show) onHidden();
  }, [onHidden, show]);

  // Faster path when drei explicitly reports we're done loading.
  useEffect(() => {
    const done =
      (!active && progress >= 100) || // tracked assets finished
      (!active && total === 0); // nothing was tracked at all

    if (done) {
      const a = setTimeout(() => setFade(true), 150);
      const b = setTimeout(() => setShow(false), 650);
      return () => {
        clearTimeout(a);
        clearTimeout(b);
      };
    }
  }, [active, progress, total]);

  if (!show) return null;

  // The progress bar shows real progress if any, else a slow indeterminate
  // sweep so the screen doesn't look frozen during the hard-timeout path.
  const barProgress = progress > 0 ? progress / 100 : 0.35;

  return (
    <div
      className="loader"
      style={{ opacity: fade ? 0 : 1, transition: 'opacity 0.5s ease' }}
    >
      <div className="inner">
        <h1 className="loader-title">Mingzhu&rsquo;s Journey</h1>
        <div className="bar">
          <div
            className="fill"
            style={{ transform: `scaleX(${Math.max(0.05, barProgress)})` }}
          />
        </div>
      </div>
    </div>
  );
}
