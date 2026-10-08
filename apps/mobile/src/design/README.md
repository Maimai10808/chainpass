# ChainPass Mobile 设计约束 / Design Contract

[中文](#zh) · [English](#en)

<a id="zh"></a>

## 中文

Holographic Graphite + Future Boarding Pass 适配原生触摸：90% 平静产品界面，10% 品牌强调。采用 Dark-first，尚无完整浅色主题。此目录只拥有 Mobile tokens，不导入 Web CSS 或共享 UI，不判断票务有效性与权限。

### 来源与用法

- `tokens.ts`：颜色、表面、字体、4pt 间距、圆角、触摸目标、图标、焦点/禁用、层级、sheet 和布局。
- `status.ts`：API 状态到展示语义的映射；未知状态保持 neutral。
- `effects.ts`：按需启用的渐变、网格色板、玻璃策略与原生阴影层级。
- `motion.ts`：毫秒时长、三套弹簧、timing 与按压反馈。
- `use-reduced-motion.ts`：系统减少动态效果偏好；读取前保守启用。
- `haptics.ts`：尽力提供语义触感，不代表业务成功。
- `index.ts`：应用导入入口。构建配置只导入纯 `tokens.ts`，避免在 Node 中加载 React Native。

```tsx
import { Text, View } from "react-native";
import { getStatusClasses, layout } from "@/design";

<View
  className="bg-surface rounded-xl p-5"
  style={{ maxWidth: layout.contentMaxWidth }}
>
  <Text className="text-body text-foreground">Digital ticket</Text>
  <Text className={getStatusClasses("ACTIVE")}>ACTIVE</Text>
</View>;
```

这是用法示例，不是业务组件或预览路由。

### 视觉约束

背景与 surface-1/2/3 构成表面层级，文字使用冷白、secondary、muted。交互 primary 与品牌强调分开；primary 使用略深的 Indigo 以保证对比。

状态映射统一：ACTIVE/PUBLISHED 为 success；DRAFT 为 neutral；PENDING 为 warning；MINTING 为 violet；ON_CHAIN/VERIFIED/CHECKED_IN 为 info；REVOKED/ERROR 为 danger。状态必须配文字，不能只靠颜色区分。

字体分九层：display、title1–3、body、body-emphasized、label、caption、mono。使用系统字体，等宽字体在 iOS 为 Menlo、Android 为 monospace。间距采用 4pt 基线，常用 4/8/12/16/20/24/32/40/48，64 用于分隔。页面 padding 为 20，紧凑模式为 16；padding 管内部，gap 管外部。

圆角保留六级；控件 lg=16，Card xl=24，sheet/Pass 2xl=32，支持的平台使用 continuous corner。触摸目标至少 44×44，主要控件和图标按钮为 48×48；这是最小尺寸，不应把文字控件锁成固定高度。Pressable 要有 label、role 与 disabled，不能用 hitSlop 代替足够大的目标。

默认实色 Card，优先表面、间距和细边框，再使用阴影。玻璃、品牌渐变和光晕按需启用；网格色板不等于已经实现渲染器。Lucide Native 默认 20/24、stroke 1.75，16/28 为例外；Native Tabs 的系统符号可保留。

### NativeWind 与动态反馈

NativeWind 4 / Tailwind 3 使用 Metro `withNativeWind`，根 layout 只导入一次 `global.css`。Babel 使用 Expo 的 `jsxImportSource` 和 nativewind 配置；Expo 处理 Worklets，不重复添加插件。Tailwind 直接消费 tokens，使用静态类名和状态 helper。`p-5` 表示 20dp，不是物理像素。iOS 显式字体 family 要对应平台变体；配置变化后重启 Metro。

旧 `Colors/useTheme` 服从深色策略，不代表已实现浅色主题。业务组件消费同一设计约束。

时长 100/160/240/340/500 的单位是**毫秒**，不能与 Web 的秒混用。snappy/smooth/gentle 使用 `ReduceMotion.System`；timing、按压反馈和偏好 hook 尊重减少动态效果，不使用 `Never`。优先动画 transform/opacity，不动画布局尺寸，也不让每个页面和 Card 都动。

`triggerHaptic` 集中提供 selection/light/medium/success/warning/error。后台、Web、无支持环境跳过，Android 使用原生 API，并支持禁用。仅对明确交互或确认成功反馈，不用于 render、自动 QR、retry 或每次点击。触感不替代视觉，更不代表服务器成功。

### 平台效果与可访问性

iOS 玻璃同时检查 Liquid Glass 和 Glass Effect API 是否可用，使用深色 scheme，不把 GlassView opacity 动画到 0。减少透明效果时退回不透明表面；旧 iOS 和 Android 默认实色。Blur 只在设备验收后按需启用，不能称为 Liquid Glass；对比度要在真实背景上检查。

阴影 helper 分别使用 iOS shadow、Android elevation、Web box-shadow；像素可不同，层级应一致。StatusBar 使用浅色图标和石墨背景；Android edge-to-edge 透出深色根背景，不添加已弃用的系统栏背景配置。

允许字号缩放、label 换行和控件增高；焦点使用 2pt Cyan，错误同时有文字和 danger。表单处理键盘滚动与 inset，不能用固定高度裁掉 CTA。

### 导航与布局

保留 Expo Router 的 Native Tabs / Stack。辅助操作使用原生 modal/sheet，不照搬桌面 sidebar/dropdown，也不新增 sheet 库。使用 sheet/grabber/overlay token，支持可访问性关闭。Expo UI 适合原生 picker、menu、date、segmented，不是第二套通用 UI；Skia 只用于特殊 Pass/Mint 展示。

Header/Tab 可能已处理安全区：iOS 滚动可自动调整，独立底部 CTA 使用 `getBottomActionPadding(insets.bottom)`。避免重复 inset，不硬编码刘海或固定 390px；平板采用 `contentMaxWidth`。

坚持语义 tokens、48pt 主要触摸目标、字号缩放、减少动态效果、平台回退和服务器状态。不使用任意 hex/圆角/时长、仅 hover 操作、全局玻璃/渐变/触感、Web CSS 或业务规则副本。

### 验证

```bash
pnpm --filter mobile lint
pnpm --filter mobile typecheck
pnpm --filter mobile test
pnpm --filter mobile exec expo export --platform ios
pnpm --filter mobile exec expo export --platform android
```

测试覆盖对比度、状态、触摸目标、inset、字体、动态反馈、效果回退和真实 Tailwind→Native CSS 编译。导出验证 JS/Metro，不证明设备安装；玻璃、触感、系统栏、Dynamic Type 仍需真机验收。不要为消除 Expo Doctor 的重复依赖警告而全局覆盖框架版本。

---

<a id="en"></a>

## English

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
