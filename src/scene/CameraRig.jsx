import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useJourney } from '../state/useJourney.js';
import { getJourneyProgress } from '../state/journeyProgress.js';
import { curve } from './track.js';
import { stations } from '../data/stations.js';
import { getOverviewCameraFrame } from './overviewCamera.js';
import { getTourCameraFrame } from './tourCamera.js';

// CameraRig — hand-tuned cinematic camera with two modes.
//
//   'overview' — A wide establishing shot that frames every station on
//                screen at once (the "diorama poster" view from the
//                reference image). A subtle horizontal drift adds life.
//
//   'tour'     — A close follow-cam: while the car is parked the camera
//                sits diagonally above and behind it; while driving it
//                pulls back so the journey reads better.
//
// Every frame we compute target position + target lookAt for the
// current mode and lerp toward them. The eased lerp is what makes
// switching between modes feel premium — never a hard cut.

const _targetPos = new THREE.Vector3();
const _lookTarget = new THREE.Vector3();
const _carPos = new THREE.Vector3();

export default function CameraRig() {
  const { camera } = useThree();
  const settled = useRef(false);

  useFrame((state) => {
    const t = getJourneyProgress();
    const isDriving = useJourney.getState().isDriving;
    const idx = useJourney.getState().currentIndex;
    const viewMode = useJourney.getState().viewMode;

    if (viewMode === 'overview') {
      // --- Overview shot ---
      // Responsive poster framing: wide screens show all stations as a
      // readable skyline, while tall screens trade some poster distance for
      // stronger first-glance scale.
      const frame = getOverviewCameraFrame({
        width: state.size.width,
        height: state.size.height,
        fov: camera.fov,
      });

      // Slow drift so the static composition still feels alive.
      const time = state.clock.elapsedTime;
      const sway = Math.sin(time * 0.1) * 0.42;
      const tiltBob = Math.cos(time * 0.08) * 0.16;
      _carPos.copy(curve.getPoint(t));
      const focusX = _carPos.x * frame.focusStrength;

      _targetPos.set(focusX + sway, frame.baseY + tiltBob, frame.baseZ);

      // Bias the look target slightly toward the car for subtle
      // intentionality — invisible most of the time, but the eye picks
      // up that the camera "knows" where the car is.
      _lookTarget.set(focusX + _carPos.x * 0.015, frame.lookY, frame.lookZ);
    } else {
      // --- Tour shot (follow-cam) ---
      _carPos.copy(curve.getPoint(t));

      // The welcome station (idx 0) presents a big interactive screen, so
      // when parked there we pull back + raise the aim to frame the panel
      // dead-center. Every other station keeps the original close framing.
      const atWelcome = idx === 0;
      const station = stations[idx];
      const atContact = station?.id === 'contact';

      // Portrait fit: the camera fov is vertical, so on a tall phone screen
      // the horizontal field gets narrow and a building/screen would crop at
      // the sides (and read oversized). getTourCameraFrame pulls back by the
      // actual horizontal shrink (1/aspect) and raises the aim so each
      // station's model fits the phone screen. Landscape is unchanged —
      // see src/scene/tourCamera.js for the math + tests.
      const aspect = state.size.width / Math.max(1, state.size.height);
      const frame = getTourCameraFrame({ aspect, isDriving, atWelcome, atContact });

      const time = state.clock.elapsedTime;
      const sway = Math.sin(time * 0.18) * 0.6;

      if (atContact && !isDriving) {
        // Head-on framing for the CONNECT HUB panel. The panel is coplanar with
        // the building's recessed bay, but the building is tilted — so instead
        // of shooting from straight ahead (which catches the panel at an angle
        // and skews it left), place the camera along the panel's OWN facing
        // direction and look straight at it. Panel-on-bay + head-on camera =
        // the panel reads flat and centred in tour, while overview keeps the
        // tilt. Derived from the panel's local position + the building tiltY.
        const tiltY = station.tiltY ?? 0;
        const P = station.connectPanel?.position ?? [0, 2.83, 1.1];
        const cosT = Math.cos(tiltY);
        const sinT = Math.sin(tiltY);
        // Panel position relative to the station (rotate its local pos by tiltY).
        const offX = P[0] * cosT + P[2] * sinT;
        const offZ = -P[0] * sinT + P[2] * cosT;
        const panelX = station.position[0] + offX;
        const panelZ = station.position[2] + offZ;
        // Panel normal = building +Z rotated by tiltY = (sinT, 0, cosT). Stand
        // the camera off along it so we view the panel face-on. Use a much
        // gentler horizontal drift here than the generic ±0.6 sway — on a flat
        // info panel viewed up close, the full sway visibly slides the text off
        // to one side; this keeps it parked near-centre.
        const contactSway = Math.sin(time * 0.18) * 0.12;
        _targetPos.set(
          panelX + frame.distance * sinT + contactSway,
          frame.height,
          panelZ + frame.distance * cosT,
        );
        _lookTarget.set(panelX, frame.parkedLookY, panelZ);
      } else {
        _targetPos.set(_carPos.x + sway, frame.height, _carPos.z + frame.distance);
        _lookTarget.set(
          isDriving ? _carPos.x : station.position[0],
          isDriving ? 0.6 : frame.parkedLookY,
          isDriving ? _carPos.z : station.position[2],
        );
      }
    }

    // First frame: snap. Subsequent frames lerp. The lerp speed is the
    // same across modes so switching feels smooth (≈1 second to settle).
    const alpha = settled.current ? 0.05 : 1.0;
    camera.position.lerp(_targetPos, alpha);

    if (!camera.userData._lookAt) {
      camera.userData._lookAt = _lookTarget.clone();
    }
    camera.userData._lookAt.lerp(_lookTarget, settled.current ? 0.08 : 1.0);
    camera.lookAt(camera.userData._lookAt);

    settled.current = true;
  });

  return null;
}
