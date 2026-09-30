import { Image } from "expo-image";
import { Link } from "expo-router";
import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { formatEventDate } from "@/lib/format";
import { useTheme } from "@/hooks/use-theme";

export const EventCard = memo(function EventCard({
  coverImageUrl,
  eventId,
  location,
  name,
  startsAt,
}: {
  coverImageUrl: string | null;
  eventId: string;
  location: string | null;
  name: string;
  startsAt: string;
}) {
  const theme = useTheme();
  return (
    <Link href={{ pathname: "/events/[eventId]", params: { eventId } }} asChild>
      <Pressable
        accessibilityLabel={`View ${name}`}
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: theme.background,
            borderColor: theme.border,
            opacity: pressed ? 0.72 : 1,
          },
        ]}
      >
        {coverImageUrl ? (
          <Image
            cachePolicy="memory-disk"
            contentFit="cover"
            recyclingKey={eventId}
            source={{ uri: coverImageUrl }}
            style={styles.cover}
            transition={180}
          />
        ) : (
          <View
            style={[
              styles.cover,
              styles.placeholder,
              { backgroundColor: theme.backgroundSelected },
            ]}
          >
            <Text style={[styles.placeholderText, { color: theme.primary }]}>
              CHAINPASS
            </Text>
          </View>
        )}
        <View style={styles.content}>
          <Text numberOfLines={2} style={[styles.name, { color: theme.text }]}>
            {name}
          </Text>
          <Text style={[styles.meta, { color: theme.textSecondary }]}>
            {formatEventDate(startsAt)}
          </Text>
          <Text
            numberOfLines={1}
            style={[styles.meta, { color: theme.textSecondary }]}
          >
            {location ?? "Location to be announced"}
          </Text>
        </View>
      </Pressable>
    </Link>
  );
});

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 22,
    borderCurve: "continuous",
    overflow: "hidden",
  },
  cover: { width: "100%", aspectRatio: 16 / 9 },
  placeholder: { alignItems: "center", justifyContent: "center" },
  placeholderText: { fontSize: 13, fontWeight: "800", letterSpacing: 2 },
  content: { padding: 17, gap: 6 },
  name: { fontSize: 20, lineHeight: 25, fontWeight: "700" },
  meta: { fontSize: 14, lineHeight: 20 },
});
