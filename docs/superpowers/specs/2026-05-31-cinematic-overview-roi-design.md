# Cinematic Overview ROI Design

## Goal

Make the portfolio feel immediately more premium by fixing the first-screen composition: the diorama should occupy more of the viewport, sit higher in frame, and remain readable on mobile without replacing models or changing the station/content architecture.

## Scope

This pass changes only high-return visual presentation:

- Overview camera framing.
- Responsive overview camera rules for tall/narrow screens.
- A small pure helper for camera framing math so the behavior can be tested.
- Minor lighting/exposure/post-processing tuning only if needed to support clarity.

Out of scope:

- Replacing GLB assets.
- Rebuilding station models.
- Adding new portfolio content.
- Reworking the full UI navigation system.
- Implementing a full cinematic intro sequence.

## Current Problem

The real app screenshots show that the overview view places the seven-station diorama too small and too low, especially on mobile. Large unused black space dominates the first impression. Tour mode already looks stronger because it frames one station tightly, proving the existing assets can look good when the camera gives them enough visual weight.

## Design

Create a responsive overview framing helper used by `CameraRig.jsx`.

For wide screens, keep all seven stations visible but reduce empty space by using a tighter horizontal span and a lower look target. The diorama should become the subject, not a thin band at the bottom.

For narrow/tall screens, do not try to preserve the full desktop poster composition at the same scale. Instead, use a slightly tighter span and a lower camera distance so the row reads as a compact skyline. It is acceptable for labels and edge stations to be denser on mobile as long as the whole composition feels intentional and the user can switch to Tour for detail.

The implementation should keep the existing overview/tour model. The `overview` view remains the map, and `tour` remains the station detail mode.

## Verification

- Node unit tests for overview camera framing helper.
- `npm run build`.
- Browser screenshots for desktop and mobile overview.
- Browser screenshot for tour mode to ensure the existing close-up experience is not degraded.
