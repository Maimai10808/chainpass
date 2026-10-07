import { useState } from "react";
import { FlatList, Text, View } from "react-native";
import { router, type Href } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import type { ManagedEventSummary } from "@chainpass/schemas";
import { apiClient } from "@/lib/api-client";
import { useSession } from "@/lib/auth-client";
import { keys } from "@/lib/product";
import { formatEventDate } from "@/lib/format";
import { errorMessage } from "@/lib/errors";
import { getStatusTone } from "@/design";
import {
  Card,
  Fact,
  Heading,
  StatusPill,
  ActionButton,
  FilterBar,
  SkeletonList,
  ScreenState,
  layoutStyles,
  text,
} from "./ui";

export function useManagedEvents(admin = false) {
  const { data: session } = useSession();
  const uid = session?.user.id ?? "";
  return useQuery({
    queryKey: admin ? keys.adminEvents(uid) : keys.merchantEvents(uid),
    queryFn: () =>
      admin ? apiClient.listAdminEvents() : apiClient.listMyEvents(),
    enabled: Boolean(uid),
  });
}
export function ManagedEventCard({
  event,
  admin = false,
}: {
  event: ManagedEventSummary;
  admin?: boolean;
}) {
  return (
    <Card>
      <View style={layoutStyles.spread}>
        <Text style={[text.subheading, { flex: 1 }]}>{event.name}</Text>
        <StatusPill label={event.status} tone={getStatusTone(event.status)} />
      </View>
      <Fact label="Date" value={formatEventDate(event.startsAt)} />
      <Fact label="Location" value={event.location ?? "To be announced"} />
      {admin && <Fact label="Organizer" value={event.organizer.name} />}
      <Text style={text.body}>{event.ticketTypeCount} ticket types</Text>
      <ActionButton
        tone="secondary"
        label="Manage event"
        onPress={() =>
          router.push({
            pathname: "/merchant/events/[eventId]",
            params: { eventId: event.id },
          } as Href)
        }
      />
    </Card>
  );
}
export function ManagedEvents({ admin = false }: { admin?: boolean }) {
  const events = useManagedEvents(admin);
  const [filter, setFilter] = useState("All");
  if (events.isPending) return <SkeletonList />;
  if (events.isError)
    return (
      <ScreenState
        title="Events unavailable"
        description={errorMessage(events.error)}
        action={
          <ActionButton label="Retry" onPress={() => void events.refetch()} />
        }
      />
    );
  return (
    <FlatList
      style={layoutStyles.screen}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={layoutStyles.listContent}
      data={events.data.filter(
        (event) => filter === "All" || event.status === filter.toUpperCase(),
      )}
      keyExtractor={(event) => event.id}
      refreshing={events.isRefetching}
      onRefresh={() => void events.refetch()}
      ListHeaderComponent={
        <View style={layoutStyles.section}>
          <Heading
            eyebrow={admin ? "ADMIN" : "MERCHANT"}
            title={admin ? "Platform events." : "Your events."}
            description={
              admin
                ? "Published and draft events across the platform."
                : "From the first draft to the front door."
            }
          />
          <FilterBar
            values={["All", "Draft", "Published"]}
            value={filter}
            onChange={setFilter}
          />
          {!admin && (
            <ActionButton
              label="Create event"
              onPress={() => router.push("/merchant/events/new" as Href)}
            />
          )}
        </View>
      }
      ListEmptyComponent={
        <ScreenState
          title="No events here yet"
          description="Choose another filter or create your first event."
        />
      }
      renderItem={({ item }) => <ManagedEventCard event={item} admin={admin} />}
    />
  );
}
