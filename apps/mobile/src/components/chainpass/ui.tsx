import type { PropsWithChildren, ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type ViewStyle,
} from "react-native";

import { useTheme } from "@/hooks/use-theme";

export function ScreenState({
  action,
  description,
  loading = false,
  title,
}: {
  action?: ReactNode;
  description?: string;
  loading?: boolean;
  title: string;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.state, { backgroundColor: theme.background }]}>
      {loading ? (
        <ActivityIndicator color={theme.primary} size="large" />
      ) : null}
      <Text style={[styles.stateTitle, { color: theme.text }]}>{title}</Text>
      {description ? (
        <Text style={[styles.stateDescription, { color: theme.textSecondary }]}>
          {description}
        </Text>
      ) : null}
      {action ? <View style={styles.stateAction}>{action}</View> : null}
    </View>
  );
}

export function Card({ children }: PropsWithChildren) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.background, borderColor: theme.border },
      ]}
    >
      {children}
    </View>
  );
}

export function ActionButton({
  disabled,
  label,
  loading = false,
  onPress,
  tone = "primary",
  ...props
}: Omit<PressableProps, "children" | "style"> & {
  label: string;
  loading?: boolean;
  tone?: "primary" | "secondary" | "danger";
}) {
  const theme = useTheme();
  const backgroundColor =
    tone === "primary"
      ? theme.primary
      : tone === "danger"
        ? theme.danger
        : theme.backgroundElement;
  const color = tone === "secondary" ? theme.text : "#FFFFFF";

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor,
          opacity: disabled || loading ? 0.5 : pressed ? 0.75 : 1,
        },
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={color} />
      ) : (
        <Text style={[styles.buttonText, { color }]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function StatusPill({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "success" | "warning" | "danger" | "neutral";
}) {
  const theme = useTheme();
  const color =
    tone === "success"
      ? theme.success
      : tone === "warning"
        ? theme.warning
        : tone === "danger"
          ? theme.danger
          : theme.textSecondary;
  return (
    <View style={[styles.pill, { backgroundColor: theme.backgroundElement }]}>
      <Text style={[styles.pillText, { color }]}>{label}</Text>
    </View>
  );
}

export const layoutStyles: Record<
  "screen" | "listContent" | "scrollContent" | "section" | "row" | "spread",
  ViewStyle
> = {
  screen: { flex: 1 },
  listContent: { paddingHorizontal: 20, paddingBottom: 32, gap: 14 },
  scrollContent: { padding: 20, paddingBottom: 40, gap: 18 },
  section: { gap: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  spread: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
};

const styles = StyleSheet.create({
  state: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
    gap: 10,
  },
  stateTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "700",
    textAlign: "center",
  },
  stateDescription: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    maxWidth: 360,
  },
  stateAction: { marginTop: 8, minWidth: 180 },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
    borderCurve: "continuous",
    padding: 18,
    gap: 12,
  },
  button: {
    minHeight: 48,
    borderRadius: 14,
    borderCurve: "continuous",
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { fontSize: 16, fontWeight: "700" },
  pill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pillText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
});
