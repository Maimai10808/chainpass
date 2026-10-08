import { useState } from "react";
import { router } from "expo-router";
import { FlatList, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { keys } from "@/lib/product";
import { errorMessage } from "@/lib/errors";
import { EventCard } from "@/components/chainpass/event-card";
import {
  Heading,
  Field,
  SkeletonList,
  ScreenState,
  ActionButton,
  Feedback,
  layoutStyles,
} from "@/components/chainpass/ui";
export default function Discover() {
  const [search, setSearch] = useState("");
  const events = useQuery({
    queryKey: keys.events,
    queryFn: () => apiClient.listPublishedEvents(),
  });
  if (events.isPending) return <SkeletonList />;
  if (events.isError && !events.data)
    return (
      <ScreenState
        title="Events unavailable"
        description={errorMessage(events.error)}
        action={
          <ActionButton label="Retry" onPress={() => void events.refetch()} />
        }
      />
    );
  const filtered =
    events.data?.filter((event) =>
      `${event.name} ${event.location ?? ""}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    ) ?? [];
  return (
    <FlatList
      style={layoutStyles.screen}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={layoutStyles.listContent}
      data={filtered}
      keyExtractor={(item) => item.id}
      refreshing={events.isRefetching}
      onRefresh={() => void events.refetch()}
      ListHeaderComponent={
        <View style={layoutStyles.section}>
          <Heading
            title="Go somewhere new."
            description="Public experiences worth showing up for. Invitation-only events are accessed through your organizer's link."
          />
          <ActionButton
            tone="secondary"
            label="Have an invitation? Open link"
            onPress={() => router.push("/invite")}
          />
          <Field
            label="Find an event"
            placeholder="Event or location"
            value={search}
            onChangeText={setSearch}
          />
          {events.isError && (
            <Feedback
              tone="warning"
              message="Showing saved events. Pull to refresh when you’re online."
            />
          )}
        </View>
      }
      ListEmptyComponent={
        <ScreenState
          title={
            search ? "No matching events" : "Your next event is on its way"
          }
          description={
            search
              ? "Try a different name or location."
              : "Public published events appear here. Have an invitation? Use Open link above."
          }
        />
      }
      renderItem={({ item }) => (
        <EventCard
          eventId={item.id}
          name={item.name}
          startsAt={item.startsAt}
          location={item.location}
          coverImageUrl={item.coverImageUrl}
        />
      )}
    />
  );
}
