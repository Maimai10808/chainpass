import type {
  ReduceMotion,
  WithSpringConfig,
  WithTimingConfig,
} from "react-native-reanimated";

/** Milliseconds, matching Reanimated (not Web Motion seconds). */
export const duration = {
  instant: 100,
  fast: 160,
  normal: 240,
  slow: 340,
  dramatic: 500,
} as const;
export const easing = {
  standard: [0.2, 0, 0, 1],
  enter: [0, 0, 0.2, 1],
  exit: [0.3, 0, 1, 0.3],
} as const;
// Reanimated's enum serializes to strings. Type-only import keeps tokens Node-testable.
const system = "system" as ReduceMotion;
export const springs = {
  snappy: { stiffness: 420, damping: 32, mass: 0.8, reduceMotion: system },
  smooth: { stiffness: 240, damping: 28, mass: 1, reduceMotion: system },
  gentle: { stiffness: 140, damping: 24, mass: 1, reduceMotion: system },
} as const satisfies Record<string, WithSpringConfig>;
export const press = {
  scale: 0.98,
  opacity: 0.88,
  haptic: "light",
  duration: duration.instant,
} as const;
export function getTiming(
  name: keyof typeof duration = "normal",
  reduceMotion = false,
): WithTimingConfig {
  "worklet";
  return { duration: reduceMotion ? 0 : duration[name], reduceMotion: system };
}
/** Choose one restrained feedback, not all effects at once. */
export function getPressFeedback(pressed: boolean, reduceMotion = false) {
  "worklet";
  return {
    opacity: pressed ? press.opacity : 1,
    scale: pressed && !reduceMotion ? press.scale : 1,
  };
}
