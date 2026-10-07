/**
 * Legacy screen aliases. New UI uses the Mobile-owned src/design foundation.
 */

import { Platform } from "react-native";
import { colors, layout, spacing, tones } from "@/design/tokens";

const legacyDark = {
  text: colors.foreground,
  background: colors.background,
  backgroundElement: colors.surface[1],
  backgroundSelected: colors.surface[2],
  textSecondary: colors.muted,
  primary: colors.primary,
  border: colors.border.default,
  success: tones.success.foreground,
  warning: tones.warning.foreground,
  danger: tones.danger.foreground,
} as const;

export const Colors = {
  // Light design is deferred. Preserve old field access without white flashes.
  light: legacyDark,
  dark: legacyDark,
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: "system-ui",
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: "ui-serif",
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: "ui-rounded",
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "var(--font-display)",
    serif: "var(--font-serif)",
    rounded: "var(--font-rounded)",
    mono: "var(--font-mono)",
  },
});

export const Spacing = {
  half: 2,
  one: spacing[4],
  two: spacing[8],
  three: spacing[16],
  four: spacing[24],
  five: spacing[32],
  six: spacing[64],
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = layout.contentMaxWidth;
