/**
 * Utility functions for rotary controls, knobs, joysticks, and dials.
 */

/**
 * Calculates the angle in degrees (0-360, with top as 0deg when offsetDegrees=90)
 * of a client point relative to an HTML element's center.
 */
export function calculateAngleFromCenter(
  element: HTMLElement,
  clientX: number,
  clientY: number,
  offsetDegrees: number = 90
): number {
  const rect = element.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  const angleRad = Math.atan2(clientY - centerY, clientX - centerX);
  const angleDeg = (angleRad * 180) / Math.PI + offsetDegrees;

  return (angleDeg % 360 + 360) % 360;
}

/**
 * Finds the closest snap angle from a list of predefined angles.
 */
export function findClosestSnapAngle(targetAngle: number, snapAngles: number[]): number {
  if (!snapAngles.length) return 0;

  let minDiff = 360;
  let closest = snapAngles[0];

  const normTarget = (targetAngle % 360 + 360) % 360;

  for (const snapAngle of snapAngles) {
    const normSnap = (snapAngle % 360 + 360) % 360;
    const diff = Math.abs(normTarget - normSnap);
    const distance = Math.min(diff, 360 - diff);

    if (distance < minDiff) {
      minDiff = distance;
      closest = snapAngle;
    }
  }

  return closest;
}

/**
 * Safely triggers browser haptic vibration if supported.
 */
export function triggerHaptic(durationMs: number | number[] = 1): void {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(durationMs);
  }
}
