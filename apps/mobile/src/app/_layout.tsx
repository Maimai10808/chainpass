import "@/global.css";

import { DarkTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";

import { AnimatedSplashOverlay } from "@/components/animated-icon";
import { AppQueryProvider } from "@/lib/query-client";
import { colors, tones } from "@/design/tokens";

void SplashScreen.preventAutoHideAsync();
void SystemUI.setBackgroundColorAsync(colors.background).catch(() => {
  // Keep the app usable on platforms without SystemUI support.
});
const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    card: colors.surface[1],
    text: colors.foreground,
    border: colors.border.default,
    primary: colors.primary,
    notification: tones.danger.foreground,
  },
};

export default function RootLayout() {
  return (
    <AppQueryProvider>
      <ThemeProvider value={navigationTheme}>
        <StatusBar style="light" />
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="events/[eventId]" options={{ title: "Event" }} />
          <Stack.Screen
            name="my-passes/[passId]"
            options={{ title: "Your pass" }}
          />
          <Stack.Screen
            name="auth/sign-in"
            options={{ presentation: "modal", title: "Sign in" }}
          />
          <Stack.Screen
            name="auth/sign-up"
            options={{ presentation: "modal", title: "Create account" }}
          />
        </Stack>
        <AnimatedSplashOverlay />
      </ThemeProvider>
    </AppQueryProvider>
  );
}
