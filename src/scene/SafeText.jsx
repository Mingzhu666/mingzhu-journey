import { Suspense, forwardRef } from 'react';
import { Text as DreiText } from '@react-three/drei';

// Drop-in replacement for drei's <Text> that can NEVER hang the scene.
//
// drei's Text suspends (suspend-react) until troika has preloaded its font.
// With no `font` prop, troika resolves glyphs through a CDN
// (cdn.jsdelivr.net + the font files it points to). On restricted networks
// — mainland-China mobile carriers, corporate firewalls, flaky cellular —
// that request hangs or is blocked outright, the preload promise never
// settles, and the suspension bubbles up to the big <Suspense> around
// <Stations /educationBook/…>: the ENTIRE station row (platforms, the
// welcome monitor and its command chips) simply never appears. That
// presented on phones as "the screen never becomes interactive".
//
// Wrapping every Text in its own Suspense boundary contains the damage:
// if the font CDN is unreachable, only that one label is missing while
// every station, building and interaction renders and works normally.
export const Text = forwardRef(function SafeText(props, ref) {
  return (
    <Suspense fallback={null}>
      <DreiText ref={ref} {...props} />
    </Suspense>
  );
});
