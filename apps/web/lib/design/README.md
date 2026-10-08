# ChainPass Web 视觉基础 / Visual Foundation

[中文](#zh) · [English](#en)

<a id="zh"></a>

## 中文

Holographic Ticket System 使用深石墨背景、冷白文字和克制的 Indigo / Violet / Cyan 强调。Future Boarding Pass 影响文字层级与技术元数据的呈现。普通 Card / Button 保持实色；渐变、玻璃和光晕只用于局部品牌强调。

### 事实来源

- `app/globals.css`：CSS 变量、Tailwind v4 语义别名和可选效果工具类。
- `app/layout.tsx`：固定深色根节点，使用已有 Geist Sans / Mono。
- `motion.ts`：以秒定义时长、两套弹簧参数和减少动态效果的处理。
- `status.ts`：Web 状态展示映射，不定义 API 枚举、权限或链上有效性。

这层设计约束只属于 Web，不拥有 Mobile 或共享 UI，也不决定业务规则。

### 颜色、表面与状态

使用 `bg-background text-foreground`、`bg-surface-1/2/3`、`text-muted-foreground` 和 `border-border`。边框还提供 `border-border-default/subtle/strong`。原始颜色值只放在 token 定义。

背景为 `#07080B`；三层表面为 `#0D1016`、`#131823`、`#1A202C`。正文为 `#F6F7FB`，次要文字为 `#8F97A8`。`card` 使用 surface-1；`popover` / `secondary` / `muted` 使用 surface-2，`accent` 使用 surface-3，保持冷石墨方向。

品牌色为 `#6366F1`、`#8B5CF6`、`#22D3EE`。交互 `primary` 使用更亮的 `#818CF8` 搭配深色前景以保持对比；链接和焦点环沿用 primary。品牌渐变不是默认按钮或正文样式。

| 状态                                      | 展示语义         |
| ----------------------------------------- | ---------------- |
| ACTIVE / PUBLISHED                        | success / 翡翠绿 |
| DRAFT                                     | neutral / 中性   |
| PENDING                                   | warning / 琥珀   |
| MINTING                                   | violet / 紫罗兰  |
| ON_CHAIN / ON_CHAIN_VERIFIED / CHECKED_IN | info / 青色      |
| REVOKED / ERROR                           | danger / 玫瑰红  |

`getStatusClasses` 返回静态类名，未知状态保持 neutral，不决定链上验证。实色语义背景应搭配对应的 foreground，而不是一律白字。

### 字体、间距与圆角

Geist Sans 用于 UI；`font-mono` 用于地址、交易哈希、Token / Chain ID。`text-mono` 只设置字号。

字号保持有限层级：display 48 / 行高 1.1；h1/h2/h3 为 32/28/24；body/body-sm 为 16/14；caption/label/mono 为 12/14/13。按需组合 `text-h1 md:text-display`，不全局强制所有标题。

沿用 Tailwind 4px 基线；布局别名 compact/control/card/section/page 为 8/12/24/48/32。其他间距用标准刻度，避免任意像素值。圆角 sm/md/lg/xl/2xl/full 为 8/10/14/20/28/胶囊；控件使用 lg，Card/Dialog 使用 xl，Pass 使用 2xl。不为统一外观逐个重写上游组件的合理例外。

### 特效、层级与可访问性

- `shadow-sm/md` 保持克制，优先用表面和间距表达层级。
- `brand-gradient` / `text-gradient` / `glow-subtle` / `glow-brand` 只作强调；强制颜色模式下，渐变文字退回实色。
- `glass` 使用半透明深色表面、细边框和 12px 模糊；不支持时退回 surface-2。普通 Card 不默认玻璃化。
- 自定义层级 base/sticky/dropdown/overlay/modal/toast 为 0/20/40/45/50/60，不覆盖 shadcn portal 的既有约定。
- 保留可见焦点环；disabled opacity 为 0.5，不能替代 `disabled` 属性。选择文本使用克制的 Indigo。
- fast/normal/slow/dramatic 为 120/200/320/500ms，传给 Motion 时单位为秒。`getMotionTransition(reducedMotion, preset)` 在减少动态效果时即时完成；不为使用 preset 强行增加动画。

### 使用与验证

Button / Card / Input / Dialog / Select 通过 shadcn 的语义别名自动继承；旧 `.input` 样式也使用同一焦点和表面。后续产品页面已经消费这套基础；早期安装产生的 lint/type 问题不应继续描述为当前阻塞。

```bash
pnpm --filter web test
pnpm --filter web lint
pnpm --filter web build
```

`foundation.test.mjs` 检查对比度、别名、未知状态回退、减少动态效果和真实 Tailwind 编译；这些测试不替代浏览器验收。

---

<a id="en"></a>

## English

Holographic Ticket System = deep graphite, cool whites and restrained indigo/violet/cyan accents. Future Boarding Pass influences type hierarchy and technical metadata, without owning business ticket components. Keep ordinary UI solid and quiet; gradients/glass/glow are opt-in highlights, not default buttons or cards.

## Ownership and sources

- `app/globals.css`: CSS values, Tailwind v4 semantic aliases and opt-in utilities.
- `app/layout.tsx`: fixed `.dark` root, existing Geist Sans/Mono font variables. No system/light switch or theme provider is needed yet.
- `motion.ts`: seconds-based durations, two spring presets and reduced-motion transition selection.
- `status.ts`: Web-only presentation mappings, not API enums or authorization rules.

No shared package, Mobile tokens, new font, business component or page redesign belongs in this foundation.

## Color and surfaces

Use `bg-background text-foreground`, `bg-surface-1/2/3`, `text-muted-foreground`, `border-border` (alias `border-border-default`), `border-border-subtle` and `border-border-strong`. Raw color values belong only in the global token definitions.

Background is `#07080B`; surfaces are `#0D1016`, `#131823`, `#1A202C`; text is `#F6F7FB` with muted `#8F97A8`. Preserve cool graphite, not purple surfaces. `card` is surface-1, `popover`/`secondary`/`muted` are surface-2, `accent` is surface-3.

Brand indigo/violet/cyan stay `#6366F1`, `#8B5CF6`, `#22D3EE`. Interactive `primary` uses a lighter indigo `#818CF8` with dark foreground for contrast; links and focus rings use the same primary. The indigo → violet → cyan gradient is decorative, not normal body text or a default Button.

Status text should use tinted backgrounds with the mappings from `status.ts`:

| State                                   | Tone              |
| --------------------------------------- | ----------------- |
| ACTIVE, PUBLISHED                       | success / emerald |
| DRAFT                                   | neutral           |
| PENDING                                 | warning / amber   |
| MINTING                                 | brand violet      |
| ON_CHAIN, ON_CHAIN_VERIFIED, CHECKED_IN | info / cyan       |
| REVOKED, ERROR                          | danger / rose     |

`getStatusClasses(value)` returns literal border/background/text classes; unknown values remain neutral. It does not derive chain verification or override server status. For a solid `bg-success` etc., pair it with `text-success-foreground` etc., not white.

## Typography, spacing and radius

Use Geist Sans for UI, headings and body. Use `font-mono` for wallet addresses, hashes, Token/Chain IDs; `text-mono` sets size only.

| Utility                               | Size / line height       |
| ------------------------------------- | ------------------------ |
| text-display                          | 48px / 1.1, semibold     |
| text-h1 / text-h2 / text-h3           | 32 / 28 / 24px, semibold |
| text-body / text-body-sm              | 16 / 14px, 1.5           |
| text-caption / text-label / text-mono | 12 / 14 / 13px           |

Use responsive combinations such as `text-h1 md:text-display`; do not impose global heading sizes on existing pages.

Tailwind keeps its 4px baseline. Named layout spacing is `compact=8px`, `control=12px`, `card=24px`, `section=48px`, `page=32px`, e.g. `gap-compact`, `p-card`, `px-page`. Use ordinary scale values for other needs; no ad hoc 17/23/29px spacing.

Radius: `rounded-sm/md/lg/xl/2xl/full` = 8/10/14/20/28px/pill. Controls use lg, cards/dialogs xl, future pass visuals 2xl. Existing upstream component exceptions stay untouched.

## Effects, layers and accessibility

- `shadow-sm` / `shadow-md`: restrained depth, not the primary hierarchy mechanism.
- `brand-gradient`, `text-gradient`, `glow-subtle`, `glow-brand`: highlights only. `text-gradient` falls back to solid text in forced-colors mode.
- `glass`: deep translucent surface, subtle border and 12px backdrop blur; unsupported browsers get solid surface-2. Ordinary cards remain solid.
- New custom layers: `z-base=0`, `z-sticky=20`, `z-dropdown=40`, `z-overlay=45`, `z-modal=50`, `z-toast=60`. Do not override shadcn portal stacking; its existing layers remain component-owned.
- Keyboard focus: visible primary ring/outline. Never remove focus feedback. Disabled opacity is 0.5 (`disabled:disabled-opacity`); it does not replace the actual `disabled` attribute. Selection uses restrained indigo.
- Motion durations: fast/normal/slow/dramatic = 120/200/320/500ms. Motion APIs consume seconds. Use `getMotionTransition(reducedMotion, "snappy" | "smooth")` with the consumer's preference; reduced motion gets an instant transition. Do not add movement merely because presets exist. Future non-spring transitions must also respect that preference.

## Compatibility and adoption

Button/Card/Input/Dialog/Select keep their existing implementations and consume the shadcn aliases automatically. The legacy `.input` class retains its layout API but uses dark surface/border/focus tokens.

Product screens now consume this foundation. The original UI-installation lint/type issues were addressed in later product work; that historical note is not a current blocker. Foundation changes still do not authorize page redesign.

## Validation

From `apps/web`, run `node --test lib/design/foundation.test.mjs` with Node 24. It checks normal text contrast, semantic aliases, status fallbacks, reduced-motion selection and actual Tailwind utility compilation. This does not replace `pnpm --filter web lint` or `pnpm --filter web build`, nor claim browser-level page acceptance.

Reference: [Tailwind theme variables](https://tailwindcss.com/docs/theme), [shadcn theming](https://ui.shadcn.com/docs/theming).
