import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/** Conservative initial state; responds to changes, unlike a launch-time snapshot. */
export function useReducedMotionPreference(): boolean {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let alive = true;
    let changed = false;
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (value) => {
        changed = true;
        setReduced(value);
      },
    );
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (alive && !changed) setReduced(value);
      })
      .catch(() => {
        /* Keep the accessible fallback. */
      });
    return () => {
      alive = false;
      subscription.remove();
    };
  }, []);
  return reduced;
}
