import { Text, View } from "react-native";
import { useState } from "react";
import { router, type Href } from "expo-router";
import {
  useManagedEvents,
  ManagedEventCard,
} from "@/components/chainpass/managed-events";
import {
  Screen,
  Heading,
  Card,
  ActionButton,
  SkeletonList,
  ScreenState,
  Fact,
  layoutStyles,
  text,
} from "@/components/chainpass/ui";
import { errorMessage } from "@/lib/errors";
export default function MerchantOverview() {
  const events = useManagedEvents();
  const [now] = useState(() => Date.now());
  if (events.isPending) return <SkeletonList />;
  if (events.isError)
    return (
      <ScreenState
        title="Workspace unavailable"
        description={errorMessage(events.error)}
        action={
          <ActionButton label="Retry" onPress={() => void events.refetch()} />
        }
      />
    );
  const data = events.data;
  return (
    <Screen>
      <Heading
        eyebrow="MERCHANT"
        title="Make it happen."
        description="Plan your events. Welcome your people."
      />
      <Card>
        <View style={layoutStyles.spread}>
          <Fact label="My events" value={String(data.length)} />
          <Fact
            label="Draft"
            value={String(
              data.filter((event) => event.status === "DRAFT").length,
            )}
          />
          <Fact
            label="Published"
            value={String(
              data.filter((event) => event.status === "PUBLISHED").length,
            )}
          />
          <Fact
            label="Upcoming"
            value={String(
              data.filter((event) => Date.parse(event.startsAt) > now).length,
            )}
          />
        </View>
      </Card>
      <View style={layoutStyles.section}>
        <ActionButton
          label="Create event"
          onPress={() => router.push("/merchant/events/new" as Href)}
        />
        <ActionButton
          label="Open check-in"
          tone="secondary"
          onPress={() => router.push("/merchant/check-in" as Href)}
        />
      </View>
      <Text style={text.heading}>Recent events</Text>
      {data.slice(0, 3).map((event) => (
        <ManagedEventCard key={event.id} event={event} />
      ))}
      {!data.length && (
        <Card>
          <Text style={text.body}>
            Your first event starts with a draft. Add tickets, then publish when
            ready.
          </Text>
        </Card>
      )}
    </Screen>
  );
}
