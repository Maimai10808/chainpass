# ChainPass Mobile Design Contract

Holographic Graphite + Future Boarding Pass, adapted for native touch. 90% calm
product UI, 10% holographic highlight. Dark-first; a complete light theme is not
implemented. This folder owns Mobile tokens, never imports Web CSS or a shared UI
package, and never decides ticket validity or permissions.

## Sources and usage

- `tokens.ts`: colors, surfaces, typography, 4pt spacing, radii, touch, icons,
  focus/disabled states, layers, sheets and screen layout.
- `status.ts`: API status → presentation tone; unknown states stay neutral.
- `effects.ts`: opt-in gradients, mesh palette, glass policy and native elevation.
- `motion.ts`: millisecond durations, three springs, timing and press feedback.
- `use-reduced-motion.ts`: live system preference, conservatively enabled until read.
- `haptics.ts`: best-effort semantic feedback, not business success.
- `index.ts`: application imports. Build configuration imports pure `tokens.ts`
  so it never loads React Native in Node.

```tsx
import { Text, View } from "react-native";
import { colors, getStatusClasses, layout } from "@/design";

<View
  className="bg-surface rounded-xl p-5"
  style={{ maxWidth: layout.contentMaxWidth }}
>
  <Text className="text-body text-foreground">Digital ticket</Text>
  <Text className={getStatusClasses("ACTIVE")}>ACTIVE</Text>
</View>;
```

These are usage snippets, not a preview route or business component.

## Visual language

| Area       | Contract                                                                                                                                                                                                              |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Colors     | Background → surface 1/2/3; cold-white body, secondary/muted metadata. Semantic primary for controls; brand swatches for highlights. Primary is slightly deeper indigo for normal-text contrast.                      |
| Status     | ACTIVE/PUBLISHED success, DRAFT neutral, PENDING warning, MINTING violet, ON_CHAIN/VERIFIED/CHECKED_IN info, REVOKED/ERROR danger. Always include a text label, not color alone.                                      |
| Typography | Nine levels: display, title-1/2/3, body, body-emphasized, label, caption, mono. System fonts; Menlo iOS, monospace Android for addresses/hash/serial. No downloaded font dependency.                                  |
| Spacing    | 4pt baseline, typically 4/8/12/16/20/24/32/40/48; 64 for large separation. Horizontal screen padding 20 (compact 16). Padding within, gap between.                                                                    |
| Shape      | Six radii. Controls lg (16); cards xl (24); sheets/Pass 2xl (32). Use continuous corner curves on supported native views.                                                                                             |
| Touch      | Minimum 44×44; primary controls and icon buttons 48×48. These are minimums, never fixed text heights. Use Pressable and meaningful labels/roles/disabled state. Hit slop supplements, not replaces, adequate targets. |
| Surface    | Solid cards by default. Hierarchy via surface, spacing and sparse fine borders; elevation low/medium/overlay is secondary.                                                                                            |
| Effects    | Only brand/holographic gradients and subtle/brand glow. No default glass, gradient buttons or glowing lists. Mesh palette is data, not a background renderer.                                                         |
| Icon       | Lucide Native 20/24, stroke 1.75; 16/28 exceptional. Existing native tab system symbols remain appropriate platform affordances.                                                                                      |

## NativeWind 4 / Tailwind 3

Metro uses Expo's default config wrapped by `withNativeWind`, with
`src/global.css` imported once by the root layout. Babel uses the Expo preset
with `jsxImportSource: "nativewind"` and `nativewind/babel`; Expo handles the
installed Reanimated/Worklets transform. Do not add a second worklets plugin.
The TypeScript declaration merges NativeWind's `className` types.

`tailwind.config.ts` derives colors, spacing, radii and type directly from
`tokens.ts`: `bg-background`, `bg-surface`/`bg-surface-2`, `text-foreground`,
`text-muted`, `border-border`, `bg-primary`, `text-primary-foreground`,
`brand-indigo/violet/cyan`, status utilities and `min-h-control min-w-control`.
`p-5` means 20 density-independent points, not physical pixels.
Default body uses the native system font. If specifying a family explicitly, use
`font-sans ios:font-sans-ios` or `font-mono ios:font-mono-ios`. Use literal utility
names or the status helper, not dynamic string assembly.
Run Metro from `apps/mobile` (the pnpm filter does this); restart after config changes.

Product screens consume this foundation. Legacy `Colors`
and `useTheme` resolve the graphite palette even if the device prefers light;
this is an explicit dark-first policy, not an implemented light theme.
Native business components use these same tokens, never a parallel theme.

## Native motion and haptics

Durations are 100/160/240/340/500 **milliseconds**. Springs snappy/smooth/gentle
all respect Reanimated `ReduceMotion.System`. `getTiming` supplies duration and
system reduction; convert a named easing with Reanimated `Easing.bezier(...easing.enter)`
when a specific transition needs it. Animate transforms/opacity, not layout sizes.

For optional tilt/parallax/press scaling, consume `useReducedMotionPreference()`
and `getPressFeedback(pressed, reduced)`: reduced motion removes scale. Never
use `ReduceMotion.Never`. Session restoration shows a calm loading boundary.
Do not animate every screen/card; gesture continuity and prompt feedback matter
more than dramatic movement.

`triggerHaptic("selection" | "light" | "medium" | "success" | "warning" | "error")`
is centralized. Tabs/select → selection, important press → light, confirmed
Claim/Wallet/Mint/Check-in → success, invalid QR → error. The helper skips
background/Web, supports `enabled: false`, uses Android's native haptics API,
and catches unsupported hardware failures. Never fire on render, every tap,
automatic QR refresh or API retries. Show visible feedback too.

## Platform effects and accessibility

For iOS glass, require BOTH `isLiquidGlassAvailable()` and
`isGlassEffectAPIAvailable()` from `expo-glass-effect` before choosing native
glass. Pass `colorScheme="dark"`; do not animate GlassView opacity to zero.
Listen to `AccessibilityInfo`'s Reduce Transparency setting and pass it to
`getGlassTreatment`; reduction must use opaque `glass.fallbackSurface`.
Older iOS/Android default to solid graphite. Blur is an explicit, supported-device
opt-in with `glass.blurIntensity`/`tint`, not proof of native liquid glass.
Text contrast must be checked against the actual backdrop.

`getElevation(platform, level)` uses iOS shadow, Android elevation or Web
box-shadow. Exact pixels may differ; hierarchy and brand identity must not.
StatusBar is light on graphite; root/native splash background is graphite. Android
edge-to-edge system bars can remain transparent so the dark root shows through.
Do not add deprecated system-bar background overrides.

Keep font scaling enabled, labels wrapping and controls growing. Focus uses cyan
and a visible 2pt border/ring where supported; Input error uses danger plus text.
Keyboard-aware forms must allow scrolling to the CTA with native resize/insets
or KeyboardAvoidingView, never a fixed-height clipping form.

## Layout and navigation rules

Keep Expo Router Native Tabs/Stack. Auxiliary actions prefer native
modal/bottom sheet instead of desktop sidebars/dropdowns. No new sheet library.
Use sheet surface/radius/grabber/overlay tokens; maintain dismiss accessibility.
`@expo/ui` is appropriate for native picker/menu/date/segmented controls, not a
second universal component framework. Skia is reserved for a special Pass/Mint
brand visual, never normal controls.

Navigator headers/tabs may already own safe-area insets. For scroll content prefer
iOS `contentInsetAdjustmentBehavior="automatic"`; for an independent fixed bottom
CTA use `getBottomActionPadding(insets.bottom)` from existing safe-area context.
Do not double-add the tab/header inset. Never hardcode notch/home-indicator sizes
or screen width 390. Tablet content can be centered with `contentMaxWidth`.

## Do / Don't

DO: semantic tokens, 48pt controls, font scaling, restrained confirmation haptics,
system-reduced motion, platform fallbacks and server-owned status.

DON'T: random hex/radius/duration, hover-based interaction, every card glass,
every button gradient, every interaction haptic, business rules in tokens, Web
CSS imports, shared token packages, shaders/particles or business logic here.

## Verification

```bash
pnpm --filter mobile lint
pnpm --filter mobile typecheck
pnpm --filter mobile test
pnpm --filter mobile exec expo export --platform ios
pnpm --filter mobile exec expo export --platform android
```

Tests check contrast, status completeness/fallback, touch/insets, typography,
motion reduction, effects fallbacks and real Tailwind → native CSS conversion.
Bundle export verifies JavaScript/Metro integration, not installation on a device:
native glass, real haptics, system bars and Dynamic Type still need iOS/Android
device acceptance. Never add broad dependency overrides merely to clear Doctor's
monorepo duplicate warning.
