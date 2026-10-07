import { type PropsWithChildren } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import type { PassView } from "@chainpass/schemas";
import {
  colors,
  gradients,
  radius,
  spacing,
  springs,
  useReducedMotionPreference,
  getStatusTone,
} from "@/design";
import { formatEventDate } from "@/lib/format";
import { Fact, StatusPill, text, layoutStyles } from "./ui";

export function HolographicPass({
  pass,
  holder,
  children,
  interactive = false,
}: PropsWithChildren<{
  pass: PassView;
  holder?: string;
  interactive?: boolean;
}>) {
  const reduced = useReducedMotionPreference();
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  // Long press activates the slight tilt; ordinary vertical scrolling remains native.
  const gesture = Gesture.Pan()
    .enabled(interactive && !reduced && Platform.OS !== "web")
    .activateAfterLongPress(250)
    .onUpdate((event) => {
      x.set(Math.max(-4, Math.min(4, -event.translationY / 30)));
      y.set(Math.max(-4, Math.min(4, event.translationX / 30)));
    })
    .onFinalize(() => {
      x.set(withSpring(0, springs.smooth));
      y.set(withSpring(0, springs.smooth));
    });
  const animated = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1000 },
      { rotateX: `${x.get()}deg` },
      { rotateY: `${y.get()}deg` },
    ],
  }));
  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.ticket, animated]}>
        <LinearGradient
          pointerEvents="none"
          colors={gradients.holographic}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.accent}
        />
        <View style={styles.content}>
          <View style={layoutStyles.spread}>
            <Text
              style={[
                text.caption,
                { color: colors.brand.cyan, letterSpacing: 2 },
              ]}
            >
              CHAINPASS / ADMIT ONE
            </Text>
            <StatusPill label={pass.status} tone={getStatusTone(pass.status)} />
          </View>
          <Text style={text.heading}>{pass.event.name}</Text>
          <Text style={[text.label, { color: colors.brand.violet }]}>
            {pass.ticketType.name}
          </Text>
          <Fact
            label="Departure / Event time"
            value={formatEventDate(pass.event.startsAt)}
          />
          <Fact
            label="Destination"
            value={pass.event.location ?? "To be announced"}
          />
          {holder ? <Fact label="Holder" value={holder} /> : null}
        </View>
        <View style={styles.perforation} />
        <View style={styles.content}>
          <StatusPill
            label={
              pass.onChainStatus === "ON_CHAIN_VERIFIED"
                ? "ON-CHAIN VERIFIED"
                : "OFF-CHAIN PASS"
            }
            tone={
              pass.onChainStatus === "ON_CHAIN_VERIFIED" ? "info" : "neutral"
            }
          />
          <Fact label="Serial" value={pass.id} mono />
          {children}
        </View>
      </Animated.View>
    </GestureDetector>
  );
}
const styles = StyleSheet.create({
  ticket: {
    backgroundColor: colors.surface[1],
    borderColor: colors.border.strong,
    borderWidth: 1,
    borderRadius: radius["2xl"],
    borderCurve: "continuous",
    overflow: "hidden",
  },
  accent: { height: spacing[4] },
  content: { padding: spacing[24], gap: spacing[16] },
  perforation: {
    borderTopWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.border.strong,
    marginHorizontal: spacing[16],
  },
});
