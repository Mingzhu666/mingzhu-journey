import { useGLTF } from '@react-three/drei';

// Self-hosted Draco decoder (public/draco/, copied from three's own
// examples/jsm/libs/draco/gltf). drei's default decoder URL is
// www.gstatic.com, which is blocked or unreachable on many networks
// (mainland-China carriers, corporate proxies); when it fails every
// Draco-compressed .glb (all station buildings, the monitor, the car)
// fails to decode and the scene never finishes loading.
//
// IMPORTANT: this MUST be the *first* import of the app (see main.jsx).
// Several scene modules call `useGLTF.preload(...)` at module top level,
// and ES-module evaluation order runs those during import — before any
// code in main.jsx's body. Putting the setDecoderPath call in its own
// module imported first guarantees it runs before every preload.
useGLTF.setDecoderPath('/draco/');
