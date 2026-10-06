import type { Transition } from "motion/react";

/** Motion uses seconds, not milliseconds. These are presets, not animations. */
export const motionDuration = {
  fast: 0.12,
  normal: 0.2,
  slow: 0.32,
  dramatic: 0.5,
} as const;

export const motionSpring = {
  snappy: { type: "spring", stiffness: 420, damping: 32, mass: 0.7 },
  smooth: { type: "spring", stiffness: 180, damping: 26, mass: 1 },
} as const satisfies Record<string, Transition>;

/** Future consumers must pass their reduced-motion preference explicitly. */
export function getMotionTransition(
  reducedMotion: boolean,
  preset: keyof typeof motionSpring = "snappy",
): Transition {
  return reducedMotion ? { duration: 0 } : motionSpring[preset];
}
