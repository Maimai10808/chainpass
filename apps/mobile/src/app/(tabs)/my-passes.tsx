import type { PassView } from "@chainpass/api-client";
import { useQuery } from "@tanstack/react-query";
import { router, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";

import { PassCard } from "@/components/chainpass/pass-card";
import {
  ActionButton,
  ScreenState,
  layoutStyles,
} from "@/components/chainpass/ui";
import { useTheme } from "@/hooks/use-theme";
import { apiClient } from "@/lib/api-client";
import { useSession } from "@/lib/auth-client";
import { queryKeys } from "@/lib/query-client";

export default function MyPassesScreen() {
  const theme = useTheme();
  const { data: session, isPending: sessionPending } = useSession();
  const passes = useQuery({
    queryKey: queryKeys.myPasses,
    queryFn: () => apiClient.getMyPasses(),
    enabled: Boolean(session),
  });
  const refetchPasses = passes.refetch;

  useFocusEffect(
    useCallback(() => {
      if (session) void refetchPasses();
    }, [refetchPasses, session]),
  );

  const renderPass = useCallback(
    ({ item }: { item: PassView }) => (
      <PassCard
        eventName={item.event.name}
        location={item.event.location}
        onChainStatus={item.onChainStatus}
        passId={item.id}
        price={item.ticketType.price}
        startsAt={item.event.startsAt}
        status={item.status}
        ticketTypeName={item.ticketType.name}
      />
    ),
    [],
  );

  if (sessionPending)
    return <ScreenState loading title="Restoring your session…" />;
  if (!session) {
    return (
      <ScreenState
        action={
          <ActionButton
            label="Sign in"
            onPress={() => router.push("/auth/sign-in")}
          />
        }
        description="Sign in to see passes owned by your ChainPass account."
        title="Your passes are waiting"
      />
    );
  }
  if (passes.isPending)
    return <ScreenState loading title="Loading your passes…" />;
  if (passes.isError) {
    return (
      <ScreenState
        action={
          <ActionButton label="Retry" onPress={() => void passes.refetch()} />
        }
        description="Check your connection or sign in again."
        title="Passes unavailable"
      />
    );
  }

  return (
    <FlatList
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={layoutStyles.listContent}
      data={passes.data}
      keyExtractor={(pass) => pass.id}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>
            No passes yet
          </Text>
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            Browse a published event and claim your first pass.
          </Text>
          <ActionButton
            label="Discover events"
            onPress={() => router.push("/")}
          />
        </View>
      }
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.text }]}>My Passes</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Your active, checked-in, and revoked tickets stay tied to this
            account.
          </Text>
        </View>
      }
      onRefresh={() => void passes.refetch()}
      refreshing={passes.isRefetching}
      renderItem={renderPass}
      style={[
        layoutStyles.screen,
        { backgroundColor: theme.backgroundElement },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: 18, paddingBottom: 8, gap: 8 },
  title: { fontSize: 34, lineHeight: 39, fontWeight: "800" },
  subtitle: { fontSize: 16, lineHeight: 23 },
  empty: {
    alignItems: "stretch",
    paddingVertical: 80,
    paddingHorizontal: 24,
    gap: 12,
  },
  emptyTitle: { fontSize: 20, fontWeight: "700", textAlign: "center" },
  emptyText: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 8,
  },
});
