import type { Config } from "tailwindcss";
import {
  colors,
  layout,
  radius,
  spacing,
  tones,
  touch,
  typography,
} from "./src/design/tokens";

const toneColors = Object.fromEntries(
  Object.entries(tones).map(([name, tone]) => [
    name,
    {
      DEFAULT: tone.foreground,
      muted: tone.background,
      border: tone.border,
    },
  ]),
);
export default {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    colors: {
      transparent: "transparent",
      current: "currentColor",
      background: colors.background,
      surface: {
        DEFAULT: colors.surface[1],
        ...colors.surface,
        elevated: colors.surface[3],
      },
      foreground: {
        DEFAULT: colors.foreground,
        secondary: colors.secondary,
        muted: colors.muted,
      },
      muted: colors.muted,
      primary: {
        DEFAULT: colors.primary,
        foreground: colors.primaryForeground,
      },
      brand: colors.brand,
      border: { DEFAULT: colors.border.default, ...colors.border },
      focus: colors.focus,
      overlay: colors.overlay,
      ...toneColors,
    },
    spacing: Object.fromEntries(
      Object.values(spacing).map((value) => [value / 4, `${value}px`]),
    ),
    borderRadius: Object.fromEntries(
      Object.entries(radius).map(([name, value]) => [name, `${value}px`]),
    ),
    fontSize: Object.fromEntries(
      Object.entries(typography).map(([name, value]) => [
        name,
        [
          `${value.fontSize}px`,
          { lineHeight: `${value.lineHeight}px`, fontWeight: value.fontWeight },
        ],
      ]),
    ),
    extend: {
      fontFamily: {
        sans: ["sans-serif"],
        "sans-ios": ["System"],
        mono: ["monospace"],
        "mono-ios": ["Menlo"],
      },
      minHeight: { control: `${touch.control}px` },
      minWidth: { control: `${touch.control}px` },
      maxWidth: { content: `${layout.contentMaxWidth}px` },
    },
  },
  plugins: [],
} satisfies Config;
