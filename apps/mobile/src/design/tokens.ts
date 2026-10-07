import type { TextStyle } from "react-native";

/** Mobile-owned brand values. No Web imports or business validity decisions. */
export const colors = {
  background: "#07080B",
  surface: { 1: "#0D1016", 2: "#131823", 3: "#1A202C" },
  foreground: "#F6F7FB",
  secondary: "#B7BFCE",
  muted: "#8F97A8",
  border: { subtle: "#FFFFFF14", default: "#252C3A", strong: "#46536B" },
  brand: { indigo: "#6366F1", violet: "#8B5CF6", cyan: "#22D3EE" },
  // Slightly deeper than the brand swatch for small white control labels.
  primary: "#575AE0",
  primaryForeground: "#FFFFFF",
  focus: "#22D3EE",
  overlay: "#07080BCC",
} as const;

export const tones = {
  success: {
    foreground: "#34D399",
    background: "#34D3991A",
    border: "#34D39940",
  },
  warning: {
    foreground: "#FBBF24",
    background: "#FBBF241A",
    border: "#FBBF2440",
  },
  danger: {
    foreground: "#FDA4AF",
    background: "#FDA4AF1A",
    border: "#FDA4AF40",
  },
  info: {
    foreground: colors.brand.cyan,
    background: "#22D3EE1A",
    border: "#22D3EE40",
  },
  neutral: {
    foreground: colors.muted,
    background: colors.surface[2],
    border: colors.border.default,
  },
  violet: {
    foreground: "#C4B5FD",
    background: "#8B5CF61A",
    border: "#8B5CF640",
  },
} as const;
export type Tone = keyof typeof tones;

/** Density-independent points, on a 4pt baseline. */
export const spacing = {
  0: 0,
  4: 4,
  8: 8,
  12: 12,
  16: 16,
  20: 20,
  24: 24,
  32: 32,
  40: 40,
  48: 48,
  64: 64,
} as const;
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  "2xl": 32,
  full: 9999,
} as const;
export const touch = {
  minimum: 44,
  control: 48,
  iconButton: 48,
  hitSlop: 8,
} as const;
export const accessibility = {
  disabledOpacity: 0.5,
  focusWidth: 2,
  selection: colors.brand.cyan,
} as const;
export const icons = {
  sizes: [16, 20, 24, 28],
  defaultSize: 24,
  strokeWidth: 1.75,
} as const;
export const layers = {
  base: 0,
  sticky: 10,
  dropdown: 20,
  overlay: 30,
  modal: 40,
  toast: 50,
} as const;
export const layout = {
  screenPaddingX: spacing[20],
  compactScreenPaddingX: spacing[16],
  screenPaddingTop: spacing[16],
  sectionGap: spacing[32],
  cardGap: spacing[16],
  cardPadding: spacing[20],
  contentMaxWidth: 800,
  tabletBreakpoint: 768,
  bottomActionSpacing: spacing[16],
  inputMinHeight: touch.control,
} as const;
export const surfaces = {
  screen: colors.background,
  card: colors.surface[1],
  elevated: colors.surface[3],
  overlay: colors.overlay,
  sheet: colors.surface[2],
} as const;
export const sheet = {
  radius: radius["2xl"],
  padding: spacing[24],
  grabber: { width: 40, height: 4, color: colors.border.strong },
} as const;

export type DesignPlatform = "ios" | "android" | "web";
export function getFontFamilies(platform: DesignPlatform) {
  return platform === "ios"
    ? { sans: "System", mono: "Menlo" }
    : platform === "android"
      ? { sans: "sans-serif", mono: "monospace" }
      : { sans: "system-ui, sans-serif", mono: "ui-monospace, monospace" };
}
export const typography = {
  display: { fontSize: 40, lineHeight: 48, fontWeight: "700" },
  "title-1": { fontSize: 32, lineHeight: 40, fontWeight: "700" },
  "title-2": { fontSize: 24, lineHeight: 32, fontWeight: "700" },
  "title-3": { fontSize: 20, lineHeight: 28, fontWeight: "600" },
  body: { fontSize: 16, lineHeight: 24, fontWeight: "400" },
  "body-emphasized": { fontSize: 16, lineHeight: 24, fontWeight: "600" },
  label: { fontSize: 14, lineHeight: 20, fontWeight: "600" },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: "400" },
  mono: { fontSize: 13, lineHeight: 20, fontWeight: "400" },
} as const satisfies Record<string, TextStyle>;

/** Do not disable font scaling or impose a fixed text height when consuming. */
export function getTypography(
  platform: DesignPlatform,
  variant: keyof typeof typography,
): TextStyle {
  const fonts = getFontFamilies(platform);
  return {
    ...typography[variant],
    fontFamily: variant === "mono" ? fonts.mono : fonts.sans,
  };
}
/** Only for bottom actions whose containing navigator does not already own the inset. */
export function getBottomActionPadding(bottomInset: number): number {
  return Math.max(0, bottomInset) + layout.bottomActionSpacing;
}
