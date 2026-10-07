import { type PropsWithChildren, type ReactNode, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  colors,
  tones,
  typography,
  spacing,
  radius,
  layout,
  touch,
  getTypography,
  getPressFeedback,
  useReducedMotionPreference,
  type Tone,
} from "@/design";
export const text = StyleSheet.create({
  title: { ...typography["title-1"], color: colors.foreground },
  heading: { ...typography["title-2"], color: colors.foreground },
  subheading: { ...typography["title-3"], color: colors.foreground },
  body: { ...typography.body, color: colors.secondary },
  label: { ...typography.label, color: colors.foreground },
  caption: { ...typography.caption, color: colors.muted },
  mono: {
    ...getTypography(
      Platform.OS === "ios"
        ? "ios"
        : Platform.OS === "android"
          ? "android"
          : "web",
      "mono",
    ),
    color: colors.secondary,
  },
});
export const layoutStyles: Record<
  "screen" | "listContent" | "scrollContent" | "section" | "row" | "spread",
  ViewStyle
> = {
  screen: { flex: 1, backgroundColor: colors.background },
  listContent: {
    padding: layout.screenPaddingX,
    paddingBottom: spacing[40],
    gap: spacing[16],
    width: "100%",
    maxWidth: layout.contentMaxWidth,
    alignSelf: "center",
  },
  scrollContent: {
    padding: layout.screenPaddingX,
    paddingBottom: spacing[40],
    gap: spacing[24],
    width: "100%",
    maxWidth: layout.contentMaxWidth,
    alignSelf: "center",
  },
  section: { gap: spacing[12] },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[12],
    flexWrap: "wrap",
  },
  spread: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing[12],
    flexWrap: "wrap",
  },
};
export function Screen({
  children,
  keyboard = false,
}: PropsWithChildren<{ keyboard?: boolean }>) {
  return (
    <View style={layoutStyles.screen}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        automaticallyAdjustKeyboardInsets={keyboard}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={layoutStyles.scrollContent}
      >
        {children}
      </ScrollView>
    </View>
  );
}
export function Heading({
  title,
  description,
  eyebrow = "CHAINPASS",
}: {
  title: string;
  description?: string;
  eyebrow?: string;
}) {
  return (
    <View style={layoutStyles.section}>
      <Text
        style={[text.caption, { color: colors.brand.cyan, letterSpacing: 2 }]}
      >
        {eyebrow}
      </Text>
      <Text accessibilityRole="header" style={text.title}>
        {title}
      </Text>
      {Boolean(description) && <Text style={text.body}>{description}</Text>}
    </View>
  );
}
export function Card({ children }: PropsWithChildren) {
  return <View style={styles.card}>{children}</View>;
}
export function ActionButton({
  label,
  loading = false,
  disabled,
  tone = "primary",
  ...props
}: Omit<PressableProps, "children" | "style"> & {
  label: string;
  loading?: boolean;
  tone?: "primary" | "secondary" | "danger";
}) {
  const reduced = useReducedMotionPreference();
  const color =
    tone === "primary"
      ? colors.primaryForeground
      : tone === "danger"
        ? tones.danger.foreground
        : colors.foreground;
  return (
    <Pressable
      {...props}
      accessibilityRole="button"
      accessibilityLabel={props.accessibilityLabel ?? label}
      accessibilityState={{
        disabled: Boolean(disabled || loading),
        busy: loading,
      }}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor:
            tone === "primary"
              ? colors.primary
              : tone === "danger"
                ? tones.danger.background
                : colors.surface[2],
          opacity:
            disabled || loading
              ? 0.5
              : getPressFeedback(pressed, reduced).opacity,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={color}
          accessibilityLabel={`${label}, in progress`}
        />
      ) : (
        <Text style={[text.label, { color, textAlign: "center" }]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}
export function StatusPill({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: Tone;
}) {
  return (
    <View
      style={{
        alignSelf: "flex-start",
        backgroundColor: tones[tone].background,
        borderColor: tones[tone].border,
        borderWidth: 1,
        borderRadius: radius.full,
        paddingHorizontal: spacing[12],
        paddingVertical: spacing[4],
      }}
    >
      <Text
        style={[
          text.caption,
          { fontWeight: "700", color: tones[tone].foreground },
        ]}
      >
        {label.replaceAll("_", " ")}
      </Text>
    </View>
  );
}
export function Feedback({
  message,
  tone = "danger",
}: {
  message: string;
  tone?: Tone;
}) {
  return (
    <View
      accessibilityLiveRegion="polite"
      style={[
        styles.card,
        {
          backgroundColor: tones[tone].background,
          borderColor: tones[tone].border,
        },
      ]}
    >
      <Text style={[text.body, { color: tones[tone].foreground }]}>
        {message}
      </Text>
    </View>
  );
}
export function ScreenState({
  title,
  description,
  loading = false,
  action,
}: {
  title: string;
  description?: string;
  loading?: boolean;
  action?: ReactNode;
}) {
  return (
    <View
      style={[
        layoutStyles.screen,
        { justifyContent: "center", padding: spacing[24], gap: spacing[16] },
      ]}
    >
      {loading && <ActivityIndicator color={colors.brand.cyan} size="large" />}
      <Text style={[text.heading, { textAlign: "center" }]}>{title}</Text>
      {Boolean(description) && (
        <Text style={[text.body, { textAlign: "center" }]}>{description}</Text>
      )}
      {action}
    </View>
  );
}
export function SkeletonList() {
  return (
    <Screen>
      <Heading title="Loading…" description="Getting the latest information." />
      {[0, 1, 2].map((n) => (
        <View
          key={n}
          accessibilityLabel="Loading content"
          style={[styles.card, { gap: spacing[16] }]}
        >
          <View
            style={{
              height: 120,
              borderRadius: radius.lg,
              backgroundColor: colors.surface[2],
            }}
          />
          <View
            style={{
              height: 24,
              width: "70%",
              backgroundColor: colors.surface[3],
              borderRadius: radius.sm,
            }}
          />
          <View
            style={{
              height: 16,
              width: "45%",
              backgroundColor: colors.surface[2],
              borderRadius: radius.sm,
            }}
          />
        </View>
      ))}
    </Screen>
  );
}
export function Field({
  label,
  error,
  style,
  ...props
}: TextInputProps & { label: string; error?: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: spacing[8] }}>
      <Text style={text.label}>{label}</Text>
      <TextInput
        {...props}
        accessibilityLabel={label}
        autoCorrect={props.autoCorrect ?? false}
        placeholderTextColor={colors.muted}
        selectionColor={colors.focus}
        onFocus={(event) => {
          setFocused(true);
          props.onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          props.onBlur?.(event);
        }}
        style={[
          styles.input,
          {
            borderColor: error
              ? tones.danger.foreground
              : focused
                ? colors.focus
                : colors.border.default,
          },
          style,
        ]}
      />
      {Boolean(error) && (
        <Text style={{ ...text.caption, color: tones.danger.foreground }}>
          {error}
        </Text>
      )}
    </View>
  );
}
export function Fact({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <View style={{ gap: spacing[4] }}>
      <Text style={text.caption}>{label.toUpperCase()}</Text>
      <Text selectable={mono} style={mono ? text.mono : text.label}>
        {value}
      </Text>
    </View>
  );
}
export function Sheet({
  visible,
  title,
  onClose,
  children,
}: PropsWithChildren<{
  visible: boolean;
  title: string;
  onClose: () => void;
}>) {
  const reduced = useReducedMotionPreference();
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      onRequestClose={onClose}
      presentationStyle="pageSheet"
      animationType={reduced ? "none" : "slide"}
    >
      <View style={[layoutStyles.screen, { paddingTop: insets.top }]}>
        <View style={{ padding: spacing[20] }}>
          <View style={layoutStyles.spread}>
            <Text accessibilityRole="header" style={text.heading}>
              {title}
            </Text>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close dialog"
              style={styles.close}
            >
              <Text style={text.label}>Close</Text>
            </Pressable>
          </View>
        </View>
        <Screen keyboard>{children}</Screen>
      </View>
    </Modal>
  );
}
export function FilterBar<T extends string>({
  values,
  value,
  onChange,
}: {
  values: readonly T[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={layoutStyles.row}>
      {values.map((item) => (
        <Pressable
          key={item}
          onPress={() => onChange(item)}
          accessibilityRole="button"
          accessibilityState={{ selected: value === item }}
          style={[
            styles.button,
            {
              backgroundColor:
                value === item ? colors.primary : colors.surface[2],
              flexGrow: 1,
            },
          ]}
        >
          <Text style={text.label}>{item}</Text>
        </Pressable>
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  card: {
    padding: spacing[20],
    gap: spacing[16],
    borderRadius: radius.xl,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.default,
    backgroundColor: colors.surface[1],
  },
  button: {
    minHeight: touch.control,
    borderRadius: radius.lg,
    borderCurve: "continuous",
    padding: spacing[12],
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    ...typography.body,
    color: colors.foreground,
    backgroundColor: colors.surface[2],
    minHeight: touch.control,
    padding: spacing[12],
    borderWidth: 2,
    borderRadius: radius.lg,
    borderCurve: "continuous",
  },
  close: {
    minWidth: touch.minimum,
    minHeight: touch.minimum,
    justifyContent: "center",
    alignItems: "center",
  },
});
