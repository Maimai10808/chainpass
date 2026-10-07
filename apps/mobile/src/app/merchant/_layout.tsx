import { Stack } from "expo-router";
import { RoleGate } from "@/components/chainpass/session";
export default function MerchantLayout() {
  return (
    <RoleGate roles={["merchant", "admin"]}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="events/new" options={{ title: "Create event" }} />
        <Stack.Screen
          name="events/[eventId]"
          options={{ title: "Manage event" }}
        />
      </Stack>
    </RoleGate>
  );
}
