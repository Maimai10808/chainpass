import { Stack } from "expo-router";
import { RoleGate } from "@/components/chainpass/session";
export default function AdminLayout() {
  return (
    <RoleGate roles={["admin"]}>
      <Stack screenOptions={{ headerShown: false }} />
    </RoleGate>
  );
}
