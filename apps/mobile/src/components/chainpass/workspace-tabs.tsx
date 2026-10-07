import { NativeTabs } from "expo-router/unstable-native-tabs";
import { colors } from "@/design";
export function WorkspaceTabs({
  workspace,
}: {
  workspace: "merchant" | "admin";
}) {
  return (
    <NativeTabs
      backgroundColor={colors.surface[1]}
      disableTransparentOnScrollEdge
      labelStyle={{ selected: { color: colors.brand.cyan } }}
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Overview</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="square.grid.2x2" md="dashboard" />
      </NativeTabs.Trigger>
      {workspace === "admin" && (
        <NativeTabs.Trigger name="users">
          <NativeTabs.Trigger.Label>Users</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="person.2" md="group" />
        </NativeTabs.Trigger>
      )}
      <NativeTabs.Trigger name="events">
        <NativeTabs.Trigger.Label>Events</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="calendar" md="event" />
      </NativeTabs.Trigger>
      {workspace === "merchant" && (
        <NativeTabs.Trigger name="check-in">
          <NativeTabs.Trigger.Label>Check-in</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            sf="qrcode.viewfinder"
            md="qr_code_scanner"
          />
        </NativeTabs.Trigger>
      )}
      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.crop.circle" md="person" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
