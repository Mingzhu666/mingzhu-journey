// Tour follow-cam framing, extracted as a pure function (like
// overviewCamera.js) so the mobile fit is unit-testable.
//
// THE PHONE PROBLEM. The camera fov is vertical, so the horizontal field
// shrinks linearly with the viewport aspect: at aspect 0.46 (a typical
// phone in portrait) the camera sees only ~46% of the width it sees in a
// square viewport. The old fit pulled back by up to 1.7×, which was not
// enough — every station model read oversized and cropped at the sides
// when entering Tour on a phone.
//
// THE FIX. Scale the pull-back by the actual horizontal shrink (1/aspect)
// so the framed WIDTH at the station stays roughly constant across aspect
// ratios. On a 390×844 phone that lands at ~2.05× (capped at 2.1). The aim
// point and camera height also rise slightly in portrait so tall buildings
// center in the frame instead of cropping at the top.
//
// Landscape (aspect >= 1) is completely unchanged — fit is exactly 1 and
// every number matches the original hand-tuned desktop framing.

export function getTourCameraFrame({ aspect, isDriving, atWelcome, atContact }) {
  const portrait = aspect < 1;

  // Pull-back factor that compensates the horizontal field shrink.
  // Continuous at aspect = 1 (fit → 1), capped so ultra-tall viewports
  // don't push the station unreadably far away.
  const fitK = portrait ? Math.min(2.1, 1 + (1 / aspect - 1) * 0.9) : 1;

  // While driving the CAR is the subject, not a building — soften the
  // pull-back so the car doesn't read tiny between stations on phones.
  const driveK = 1 + (fitK - 1) * 0.6;

  // The welcome station (big interactive monitor) and the contact station
  // (the CONNECT HUB info panel) both present a tall flat panel, so they pull
  // back a touch more than the original close building shot.
  const distance = isDriving
    ? 9.5 * driveK
    : (atWelcome ? 7.8 : atContact ? 7.6 : 7.0) * fitK;

  // Lift the camera a touch in portrait so the extra distance still looks
  // down at the diorama rather than flat across it.
  const height =
    (isDriving ? 5.0 : atWelcome ? 5.0 : atContact ? 4.4 : 4.2) *
    (portrait ? 1 + (fitK - 1) * 0.22 : 1);

  // Raise the parked aim point in portrait so tall buildings center
  // vertically instead of cropping at the top of a tall screen.
  // EXCEPT at the welcome station: its focus monitor eases to a fixed
  // anchor height (FOCUS_ANCHOR y = 2.0 in WelcomeMonitor.jsx), and the
  // desktop aim of 2.0 is what centers that panel. Lifting the aim in
  // portrait pushed the monitor below center on phones — keep it dead-on.
  // The contact station's CONNECT HUB panel sits high on the building (its
  // centre is ~Y 2.9), so aim there instead of the low building base, or the
  // panel's title crops off the top of the frame.
  const parkedLookY = atWelcome
    ? 2.0
    : atContact
    ? 2.83 + (portrait ? (fitK - 1) * 0.15 : 0)
    : 1.0 + (portrait ? (fitK - 1) * 0.55 : 0);

  return { fitK, distance, height, parkedLookY };
}
