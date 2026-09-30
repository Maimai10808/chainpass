import {
  focusManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { type PropsWithChildren, useEffect, useState } from "react";
import { AppState, type AppStateStatus, Platform } from "react-native";

export const queryKeys = {
  events: ["events"] as const,
  event: (eventId: string) => ["event", eventId] as const,
  myPasses: ["my-passes"] as const,
  passQr: (passId: string) => ["pass-verification-token", passId] as const,
};

export function AppQueryProvider({ children }: PropsWithChildren) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            staleTime: 30_000,
          },
          mutations: { retry: 0 },
        },
      }),
  );

  useEffect(() => {
    const updateFocus = (status: AppStateStatus) => {
      if (Platform.OS !== "web") focusManager.setFocused(status === "active");
    };
    updateFocus(AppState.currentState);
    const subscription = AppState.addEventListener("change", updateFocus);
    return () => subscription.remove();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
