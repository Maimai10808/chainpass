import { useQuery } from "@tanstack/react-query";
import type { PublicEventSummary } from "@chainpass/api-client";
import { useCallback } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";

import { EventCard } from "@/components/chainpass/event-card";
import {
  ActionButton,
  ScreenState,
  layoutStyles,
} from "@/components/chainpass/ui";
import { useTheme } from "@/hooks/use-theme";
import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-client";

export default function DiscoverScreen() {
  const theme = useTheme();
  const events = useQuery({
    queryKey: queryKeys.events,
    queryFn: () => apiClient.listPublishedEvents(),
  });
  const renderEvent = useCallback(
    ({ item }: { item: PublicEventSummary }) => (
      <EventCard
        coverImageUrl={item.coverImageUrl}
        eventId={item.id}
        location={item.location}
        name={item.name}
        startsAt={item.startsAt}
      />
    ),
    [],
  );

  if (events.isPending) {
    return <ScreenState loading title="Discovering events…" />;
  }
  if (events.isError) {
    return (
      <ScreenState
        action={
          <ActionButton label="Retry" onPress={() => void events.refetch()} />
        }
        description="Check your connection and API URL, then try again."
        title="Events unavailable"
      />
    );
  }

  return (
    <FlatList
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={layoutStyles.listContent}
      data={events.data}
      keyExtractor={(event) => event.id}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>
            No published events yet
          </Text>
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            Check back after an organizer publishes the next event.
          </Text>
        </View>
      }
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={[styles.eyebrow, { color: theme.primary }]}>
            CHAINPASS
          </Text>
          <Text style={[styles.title, { color: theme.text }]}>
            Discover events
          </Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Claim a pass, keep it with you, and present a secure QR at the door.
          </Text>
        </View>
      }
      onRefresh={() => void events.refetch()}
      refreshing={events.isRefetching}
      renderItem={renderEvent}
      style={[
        layoutStyles.screen,
        { backgroundColor: theme.backgroundElement },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: 18, paddingBottom: 8, gap: 8 },
  eyebrow: { fontSize: 12, fontWeight: "800", letterSpacing: 1.8 },
  title: { fontSize: 34, lineHeight: 39, fontWeight: "800" },
  subtitle: { fontSize: 16, lineHeight: 23, maxWidth: 520 },
  empty: {
    alignItems: "center",
    paddingVertical: 80,
    paddingHorizontal: 24,
    gap: 8,
  },
  emptyTitle: { fontSize: 20, fontWeight: "700", textAlign: "center" },
  emptyText: { fontSize: 15, lineHeight: 22, textAlign: "center" },
});
