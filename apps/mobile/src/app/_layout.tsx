import "@/global.css";

import { DarkTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";

import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SessionBoundary } from "@/components/chainpass/session";
import { WalletProvider } from "@/lib/wallet";
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
  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppQueryProvider>
        <WalletProvider>
          <ThemeProvider value={navigationTheme}>
            <StatusBar style="light" />
            <SessionBoundary>
              <Stack>
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen
                  name="merchant"
                  options={{ headerShown: false }}
                />
                <Stack.Screen name="admin" options={{ headerShown: false }} />
                <Stack.Screen
                  name="invite"
                  options={{ title: "Your invitation" }}
                />
                <Stack.Screen
                  name="events/[eventId]"
                  options={{ title: "Event" }}
                />
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
            </SessionBoundary>
          </ThemeProvider>
        </WalletProvider>
      </AppQueryProvider>
    </GestureHandlerRootView>
  );
}
