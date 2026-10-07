import {
  ApiClientError,
  type ClaimPassResult,
  type PublicEventDetail,
} from "@chainpass/api-client";
import type { PublicTicketType } from "@chainpass/schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { memo, useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import {
  ActionButton,
  Card,
  ScreenState,
  StatusPill,
  layoutStyles,
} from "@/components/chainpass/ui";
import { useTheme } from "@/hooks/use-theme";
import { apiClient } from "@/lib/api-client";
import { useSession } from "@/lib/auth-client";
import { formatEventDate, formatPrice } from "@/lib/format";
import { queryKeys } from "@/lib/query-client";
import { keys } from "@/lib/product";
import { triggerHaptic, duration, radius, spacing, typography } from "@/design";
import { errorMessage } from "@/lib/errors";

type ClaimFeedback = {
  passId?: string;
  ticketTypeId: string;
  kind: "success" | "error";
  message: string;
};

export default function EventDetailScreen() {
  const { eventId = "" } = useLocalSearchParams<{ eventId: string }>();
  const theme = useTheme();
  const queryClient = useQueryClient();
  const { data: session, isPending: sessionPending } = useSession();
  const [feedback, setFeedback] = useState<ClaimFeedback | null>(null);
  const event = useQuery({
    queryKey: queryKeys.event(eventId),
    queryFn: () => apiClient.getPublishedEvent(eventId),
    enabled: Boolean(eventId),
  });
  const claim = useMutation<ClaimPassResult, unknown, string>({
    mutationFn: (ticketTypeId) => apiClient.claimPass(ticketTypeId),
    onSuccess: (result, ticketTypeId) => {
      queryClient.setQueryData<PublicEventDetail>(
        queryKeys.event(eventId),
        (current) =>
          current
            ? {
                ...current,
                ticketTypes: current.ticketTypes.map((ticketType) =>
                  ticketType.id === ticketTypeId
                    ? { ...ticketType, remaining: result.remaining }
                    : ticketType,
                ),
              }
            : current,
      );
      void queryClient.invalidateQueries({
        queryKey: keys.passes(session?.user.id ?? ""),
      });
      void triggerHaptic("success");
      setFeedback({
        ticketTypeId,
        kind: "success",
        passId: result.pass.id,
        message: "Pass claimed successfully.",
      });
    },
    onError: (error, ticketTypeId) => {
      setFeedback({
        ticketTypeId,
        kind: "error",
        message: claimErrorMessage(error),
      });
    },
  });

  const claimTicket = useCallback(
    (ticketTypeId: string) => {
      if (!session) {
        router.push({
          pathname: "/auth/sign-in",
          params: { returnTo: `/events/${eventId}` },
        });
        return;
      }
      const role = getRole(session.user);
      if (role !== "user" && role !== "admin") {
        setFeedback({
          ticketTypeId,
          kind: "error",
          message: "This account role cannot claim passes.",
        });
        return;
      }
      setFeedback(null);
      claim.mutate(ticketTypeId);
    },
    [claim, eventId, session],
  );
  const renderTicket = useCallback(
    ({ item }: { item: PublicTicketType }) => (
      <TicketTypeCard
        claimed={
          feedback?.ticketTypeId === item.id && feedback?.kind === "success"
        }
        description={item.description}
        feedback={feedback?.ticketTypeId === item.id ? feedback : null}
        disabled={
          claim.isPending ||
          sessionPending ||
          getRole(session?.user ?? {}) === "merchant"
        }
        isClaiming={claim.isPending && claim.variables === item.id}
        name={item.name}
        onClaim={claimTicket}
        price={item.price}
        remaining={item.remaining}
        ticketTypeId={item.id}
      />
    ),
    [
      claim.isPending,
      claim.variables,
      claimTicket,
      feedback,
      session,
      sessionPending,
    ],
  );

  if (event.isPending) return <ScreenState loading title="Loading event…" />;
  if (event.isError || !event.data) {
    return (
      <ScreenState
        action={
          <ActionButton label="Retry" onPress={() => void event.refetch()} />
        }
        description="This event may be unavailable or your connection may be offline."
        title="Event not available"
      />
    );
  }

  const detail = event.data;
  return (
    <FlatList
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={layoutStyles.listContent}
      data={detail.ticketTypes}
      keyExtractor={(ticketType) => ticketType.id}
      ListEmptyComponent={
        <Card>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>
            No available passes
          </Text>
          <Text style={[styles.body, { color: theme.textSecondary }]}>
            The organizer has not published an active ticket type.
          </Text>
        </Card>
      }
      ListHeaderComponent={
        <View style={styles.header}>
          {detail.coverImageUrl ? (
            <Image
              cachePolicy="memory-disk"
              contentFit="cover"
              source={{ uri: detail.coverImageUrl }}
              style={styles.cover}
              transition={duration.fast}
            />
          ) : (
            <View
              style={[
                styles.cover,
                styles.coverPlaceholder,
                { backgroundColor: theme.backgroundSelected },
              ]}
            >
              <Text style={[styles.coverLabel, { color: theme.primary }]}>
                PUBLISHED EVENT
              </Text>
            </View>
          )}
          <StatusPill label="PUBLISHED" tone="success" />
          <Text style={[styles.title, { color: theme.text }]}>
            {detail.name}
          </Text>
          {detail.description ? (
            <Text style={[styles.description, { color: theme.textSecondary }]}>
              {detail.description}
            </Text>
          ) : null}
          <Card>
            <Fact label="Organizer" value={detail.organizer.name} />
            <Fact label="Starts" value={formatEventDate(detail.startsAt)} />
            <Fact label="Ends" value={formatEventDate(detail.endsAt)} />
            <Fact
              label="Location"
              value={detail.location ?? "To be announced"}
            />
          </Card>
          <View style={styles.ticketHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Available passes
            </Text>
            <Text style={[styles.body, { color: theme.textSecondary }]}>
              Choose one ticket type. Inventory and ownership are enforced by
              the server.
            </Text>
          </View>
        </View>
      }
      onRefresh={() => void event.refetch()}
      refreshing={event.isRefetching || sessionPending}
      renderItem={renderTicket}
      style={[
        layoutStyles.screen,
        { backgroundColor: theme.backgroundElement },
      ]}
    />
  );
}

const TicketTypeCard = memo(function TicketTypeCard({
  claimed,
  disabled,
  description,
  feedback,
  isClaiming,
  name,
  onClaim,
  price,
  remaining,
  ticketTypeId,
}: {
  claimed: boolean;
  disabled: boolean;
  description: string | null;
  feedback: ClaimFeedback | null;
  isClaiming: boolean;
  name: string;
  onClaim: (ticketTypeId: string) => void;
  price: string;
  remaining: number;
  ticketTypeId: string;
}) {
  const theme = useTheme();
  const soldOut = remaining === 0;
  return (
    <Card>
      <View style={layoutStyles.spread}>
        <Text style={[styles.ticketName, { color: theme.text }]}>{name}</Text>
        <StatusPill
          label={soldOut ? "SOLD OUT" : "ACTIVE"}
          tone={soldOut ? "danger" : "success"}
        />
      </View>
      {description ? (
        <Text style={[styles.body, { color: theme.textSecondary }]}>
          {description}
        </Text>
      ) : null}
      <View style={styles.facts}>
        <Fact label="Price" value={formatPrice(price)} />
        <Fact label="Remaining" value={String(remaining)} />
      </View>
      <ActionButton
        disabled={soldOut || claimed || disabled}
        label={soldOut ? "Sold out" : claimed ? "Claimed" : "Claim pass"}
        loading={isClaiming}
        onPress={() => onClaim(ticketTypeId)}
      />
      {feedback ? (
        <View
          style={[
            styles.feedback,
            { backgroundColor: theme.backgroundElement },
          ]}
        >
          <Text
            style={{
              color: feedback.kind === "success" ? theme.success : theme.danger,
            }}
          >
            {feedback.message}
          </Text>
          {feedback.kind === "success" ? (
            <Pressable
              accessibilityRole="button"
              style={{ minHeight: 48, justifyContent: "center" }}
              onPress={() =>
                router.push({
                  pathname: "/my-passes/[passId]",
                  params: { passId: feedback.passId! },
                })
              }
            >
              <Text style={[styles.feedbackLink, { color: theme.primary }]}>
                Open your pass →
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </Card>
  );
});

function Fact({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={styles.fact}>
      <Text style={[styles.factLabel, { color: theme.textSecondary }]}>
        {label}
      </Text>
      <Text style={[styles.factValue, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

function getRole(user: object): string {
  return "role" in user && typeof user.role === "string" ? user.role : "user";
}

function claimErrorMessage(error: unknown): string {
  if (!(error instanceof ApiClientError))
    return "Unable to claim this pass. Please try again.";
  if (error.code === "PASS_ALREADY_CLAIMED")
    return "You already claimed this pass.";
  if (error.code === "TICKET_TYPE_SOLD_OUT") return "This pass is sold out.";
  if (error.status === 401)
    return "Your session expired. Sign in and try again.";
  return errorMessage(error);
}

const styles = StyleSheet.create({
  header: {
    paddingTop: spacing[8],
    paddingBottom: spacing[4],
    gap: spacing[16],
  },
  cover: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: radius.xl,
    borderCurve: "continuous",
  },
  coverPlaceholder: { alignItems: "center", justifyContent: "center" },
  coverLabel: { fontSize: 13, fontWeight: "800", letterSpacing: 2 },
  title: typography["title-1"],
  description: { fontSize: 16, lineHeight: 24 },
  sectionTitle: { fontSize: 24, lineHeight: 30, fontWeight: "700" },
  ticketHeader: { gap: 5, paddingTop: 8 },
  ticketName: { flex: 1, ...typography["title-3"] },
  body: { fontSize: 15, lineHeight: 22 },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  facts: { flexDirection: "row", gap: 24 },
  fact: { flex: 1, gap: 3 },
  factLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  factValue: { fontSize: 15, lineHeight: 21, fontWeight: "600" },
  feedback: {
    borderRadius: 12,
    borderCurve: "continuous",
    padding: 12,
    gap: 8,
  },
  feedbackLink: { fontWeight: "700" },
});
