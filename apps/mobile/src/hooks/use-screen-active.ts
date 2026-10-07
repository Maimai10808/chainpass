import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { useAppState } from "./use-app-state";
export function useScreenActive() {
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  const state = useAppState();
  return focused && state === "active";
}
