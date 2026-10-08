"use client";

import { useSyncExternalStore } from "react";

function subscribe(callback: () => void) {
  const timer = window.setInterval(callback, 1_000);
  return () => window.clearInterval(timer);
}

const snapshot = () => Math.floor(Date.now() / 1_000) * 1_000;
const serverSnapshot = () => 0;

/** A UI-only clock. API validation remains authoritative for invitation expiry. */
export function useCurrentTime() {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}
