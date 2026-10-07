import type { ViewStyle } from "react-native";
import { colors } from "./tokens";
import type { DesignPlatform } from "./tokens";

// Readonly tuples work with expo-linear-gradient; spread into Skia when needed.
export const gradients = {
  brand: [colors.brand.indigo, colors.brand.violet, colors.brand.cyan],
  holographic: [colors.brand.cyan, colors.brand.violet, colors.brand.indigo],
} as const;
export const meshPalette = [
  colors.surface[1],
  colors.brand.indigo,
  colors.brand.violet,
  colors.brand.cyan,
] as const;
export const glass = {
  surface: "#0D1016E6",
  border: colors.border.subtle,
  highlight: "#F6F7FB1A",
  blurIntensity: 24,
  tint: "dark",
  fallbackSurface: colors.surface[1],
} as const;
/** Caller checks BOTH Expo glass APIs; Android blur is explicitly opt-in. */
export function getGlassTreatment(options: {
  platform: DesignPlatform;
  nativeGlassAvailable?: boolean;
  blurAvailable?: boolean;
  reduceTransparency?: boolean;
}): "native-glass" | "blur" | "solid" {
  if (options.reduceTransparency) return "solid";
  if (options.platform === "ios" && options.nativeGlassAvailable)
    return "native-glass";
  return options.blurAvailable ? "blur" : "solid";
}
const elevation = {
  low: { android: 2, opacity: 0.18, radius: 6, offset: 2 },
  medium: { android: 4, opacity: 0.24, radius: 12, offset: 4 },
  overlay: { android: 8, opacity: 0.3, radius: 20, offset: 8 },
} as const;
export type Elevation = keyof typeof elevation;
/** Modest, semantic depth; surface contrast does the primary hierarchy work. */
export function getElevation(
  platform: DesignPlatform,
  level: Elevation,
): ViewStyle {
  const value = elevation[level];
  if (platform === "android")
    return { elevation: value.android, shadowColor: colors.background };
  if (platform === "web")
    return {
      boxShadow: `0 ${value.offset}px ${value.radius}px rgba(0, 0, 0, ${value.opacity})`,
    };
  return {
    shadowColor: colors.background,
    shadowOpacity: value.opacity,
    shadowRadius: value.radius,
    shadowOffset: { width: 0, height: value.offset },
  };
}
/** Opt-in reflection recipe, not a default shadow or cross-platform glow component. */
export const glow = {
  subtle: { color: colors.brand.cyan, opacity: 0.12, radius: 12 },
  brand: { color: colors.brand.violet, opacity: 0.2, radius: 24 },
} as const;
