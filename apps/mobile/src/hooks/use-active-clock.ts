import { useEffect, useState } from "react";

/** Update expiry labels only while the screen is focused and foregrounded. */
export function useActiveClock(active: boolean) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!active) return;
    const update = () => setNow(Date.now());
    const immediate = setTimeout(update, 0);
    const interval = setInterval(update, 1000);
    return () => {
      clearTimeout(immediate);
      clearInterval(interval);
    };
  }, [active]);
  return now;
}
