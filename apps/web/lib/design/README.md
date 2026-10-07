# ChainPass Web Visual Foundation

Holographic Ticket System = deep graphite, cool whites and restrained indigo/violet/cyan accents. Future Boarding Pass influences type hierarchy and technical metadata, not a ticket component yet. Keep ordinary UI solid and quiet; gradients/glass/glow are opt-in highlights, not default buttons or cards.

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

Existing business pages still explicitly use white/zinc classes. They are not globally recolored or redesigned here; move them to semantic tokens when that page is deliberately redesigned. Existing component lint/type failures from the initial UI installation are separate from this foundation.

## Validation

From `apps/web`, run `node --test lib/design/foundation.test.mjs` with Node 24. It checks normal text contrast, semantic aliases, status fallbacks, reduced-motion selection and actual Tailwind utility compilation. This does not replace `pnpm --filter web lint` or `pnpm --filter web build`, nor claim browser-level page acceptance.

Reference: [Tailwind theme variables](https://tailwindcss.com/docs/theme), [shadcn theming](https://ui.shadcn.com/docs/theming).
