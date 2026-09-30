import { Link } from "expo-router";
import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Card, StatusPill, layoutStyles } from "./ui";
import { useTheme } from "@/hooks/use-theme";
import { formatEventDate, formatPrice } from "@/lib/format";

export const PassCard = memo(function PassCard({
  eventName,
  location,
  onChainStatus,
  passId,
  price,
  startsAt,
  status,
  ticketTypeName,
}: {
  eventName: string;
  location: string | null;
  onChainStatus: "OFF_CHAIN" | "ON_CHAIN_VERIFIED";
  passId: string;
  price: string;
  startsAt: string;
  status: "ACTIVE" | "CHECKED_IN" | "REVOKED";
  ticketTypeName: string;
}) {
  const theme = useTheme();
  const tone =
    status === "ACTIVE"
      ? "success"
      : status === "REVOKED"
        ? "danger"
        : "warning";
  return (
    <Link
      href={{ pathname: "/my-passes/[passId]", params: { passId } }}
      asChild
    >
      <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.72 : 1 })}>
        <Card>
          <View style={layoutStyles.spread}>
            <Text
              numberOfLines={2}
              style={[styles.event, { color: theme.text }]}
            >
              {eventName}
            </Text>
            <StatusPill label={status.replaceAll("_", " ")} tone={tone} />
          </View>
          <Text style={[styles.ticket, { color: theme.primary }]}>
            {ticketTypeName}
          </Text>
          <View style={styles.details}>
            <Text style={[styles.meta, { color: theme.textSecondary }]}>
              {formatEventDate(startsAt)}
            </Text>
            <Text
              numberOfLines={1}
              style={[styles.meta, { color: theme.textSecondary }]}
            >
              {location ?? "Location to be announced"}
            </Text>
            <Text style={[styles.meta, { color: theme.textSecondary }]}>
              {formatPrice(price)} ·{" "}
              {onChainStatus === "ON_CHAIN_VERIFIED" ? "On-chain" : "Off-chain"}
            </Text>
          </View>
          <Text style={[styles.open, { color: theme.primary }]}>
            View pass →
          </Text>
        </Card>
      </Pressable>
    </Link>
  );
});

const styles = StyleSheet.create({
  event: { flex: 1, fontSize: 20, lineHeight: 25, fontWeight: "700" },
  ticket: { fontSize: 15, lineHeight: 21, fontWeight: "700" },
  details: { gap: 4 },
  meta: { fontSize: 14, lineHeight: 20 },
  open: { fontSize: 14, fontWeight: "700" },
});
