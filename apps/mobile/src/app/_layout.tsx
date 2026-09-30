import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useColorScheme } from "react-native";

import { AnimatedSplashOverlay } from "@/components/animated-icon";
import { AppQueryProvider } from "@/lib/query-client";

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <AppQueryProvider>
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
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
