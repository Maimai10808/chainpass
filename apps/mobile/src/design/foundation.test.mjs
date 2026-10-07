import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
// Use Tailwind's own TS-config loader dependency; no native-module mocks or test framework.
const tailwindRequire = createRequire(
  require.resolve("tailwindcss/package.json"),
);
const load = tailwindRequire("jiti")(fileURLToPath(import.meta.url));
const tokens = load("./tokens.ts");
const status = load("./status.ts");
const effects = load("./effects.ts");
const motion = load("./motion.ts");

function rgb(hex) {
  return [1, 3, 5].map(
    (index) => parseInt(hex.slice(index, index + 2), 16) / 255,
  );
}
function contrast(a, b) {
  const luminance = (color) =>
    rgb(color)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
      .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
  const values = [luminance(a), luminance(b)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}
function opaque(color, backing) {
  if (color.length === 7) return color;
  const alpha = parseInt(color.slice(7, 9), 16) / 255;
  return (
    "#" +
    rgb(color)
      .map((value, index) =>
        Math.round((value * alpha + rgb(backing)[index] * (1 - alpha)) * 255)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

test("graphite surfaces, control labels and semantic text meet normal-text contrast", () => {
  const { colors, tones } = tokens;
  assert.equal(colors.background, "#07080B");
  for (const surface of [colors.background, ...Object.values(colors.surface)]) {
    for (const foreground of [
      colors.foreground,
      colors.secondary,
      colors.muted,
    ])
      assert.ok(
        contrast(foreground, surface) >= 4.5,
        `${foreground} on ${surface}`,
      );
    for (const tone of Object.values(tones))
      assert.ok(
        contrast(tone.foreground, opaque(tone.background, surface)) >= 4.5,
      );
    assert.ok(contrast(colors.focus, surface) >= 3);
  }
  assert.ok(contrast(colors.primaryForeground, colors.primary) >= 4.5);
});

test("all business states have safe presentation-only mappings", () => {
  assert.deepEqual(
    Object.keys(status.statusTone).sort(),
    [
      "ACTIVE",
      "PUBLISHED",
      "DRAFT",
      "PENDING",
      "MINTING",
      "ON_CHAIN",
      "ON_CHAIN_VERIFIED",
      "CHECKED_IN",
      "REVOKED",
      "ERROR",
    ].sort(),
  );
  for (const name of Object.keys(status.statusTone)) {
    const tone = status.getStatusTone(name);
    assert.equal(status.getStatusColors(name), tokens.tones[tone]);
    assert.equal(status.getStatusClasses(name), status.statusClasses[tone]);
  }
  assert.equal(status.getStatusTone("UNKNOWN"), "neutral");
  assert.equal(status.getStatusTone("__proto__"), "neutral");
  assert.equal(status.statusTone.CHECKED_IN, "info");
});

test("4pt spacing, accessible controls, insets and tablet width stay bounded", () => {
  assert.ok(Object.values(tokens.spacing).every((value) => value % 4 === 0));
  assert.ok(tokens.touch.minimum >= 44);
  assert.ok(tokens.touch.control >= 48);
  assert.equal(tokens.layout.inputMinHeight, tokens.touch.control);
  assert.equal(tokens.getBottomActionPadding(34), 50);
  assert.equal(tokens.getBottomActionPadding(0), 16);
  assert.equal(tokens.getBottomActionPadding(-1), 16);
  assert.ok(tokens.layout.contentMaxWidth > tokens.layout.tabletBreakpoint);
  assert.deepEqual(Object.keys(tokens.radius), [
    "sm",
    "md",
    "lg",
    "xl",
    "2xl",
    "full",
  ]);
});

test("typography is small, native and independent of downloaded fonts", () => {
  assert.equal(Object.keys(tokens.typography).length, 9);
  for (const value of Object.values(tokens.typography))
    assert.ok(value.lineHeight >= value.fontSize);
  assert.equal(tokens.getTypography("ios", "mono").fontFamily, "Menlo");
  assert.equal(
    tokens.getTypography("android", "body").fontFamily,
    "sans-serif",
  );
  assert.equal(tokens.getTypography("android", "mono").fontFamily, "monospace");
});

test("motion uses valid milliseconds and system-aware, reduced press feedback", () => {
  assert.deepEqual(Object.values(motion.duration), [100, 160, 240, 340, 500]);
  for (const value of Object.values(motion.springs)) {
    assert.ok(value.stiffness > 0 && value.damping > 0 && value.mass > 0);
    assert.equal(value.reduceMotion, "system");
  }
  assert.equal(motion.getTiming("normal").duration, 240);
  assert.equal(motion.getTiming("dramatic", true).duration, 0);
  assert.equal(motion.getPressFeedback(true).scale, 0.98);
  assert.equal(motion.getPressFeedback(true, true).scale, 1);
  assert.deepEqual(motion.getPressFeedback(false), { opacity: 1, scale: 1 });
  for (const value of Object.values(motion.easing))
    assert.ok(value.every((n) => n >= 0 && n <= 1));
});

test("limited gradients and platform effects have conservative fallbacks", () => {
  const { gradients, getGlassTreatment, getElevation } = effects;
  assert.deepEqual(gradients.brand, Object.values(tokens.colors.brand));
  assert.deepEqual(gradients.holographic, [...gradients.brand].reverse());
  assert.ok(effects.meshPalette.every((color) => /^#[0-9A-F]{6}$/.test(color)));
  assert.equal(
    getGlassTreatment({ platform: "android", nativeGlassAvailable: true }),
    "solid",
  );
  assert.equal(
    getGlassTreatment({ platform: "ios", nativeGlassAvailable: true }),
    "native-glass",
  );
  assert.equal(getGlassTreatment({ platform: "ios" }), "solid");
  assert.equal(
    getGlassTreatment({ platform: "android", blurAvailable: true }),
    "blur",
  );
  assert.equal(
    getGlassTreatment({
      platform: "ios",
      nativeGlassAvailable: true,
      reduceTransparency: true,
    }),
    "solid",
  );
  assert.ok(
    getElevation("android", "overlay").elevation >
      getElevation("android", "low").elevation,
  );
  assert.ok(getElevation("ios", "medium").shadowOpacity <= 0.3);
  assert.ok(getElevation("web", "low").boxShadow);
});

test("NativeWind compiles semantic classes from the shared TypeScript token source", async (t) => {
  // Match Metro's native Tailwind preset rather than accidentally testing the Web preset.
  const previousPlatform = process.env.NATIVEWIND_OS;
  process.env.NATIVEWIND_OS = "ios";
  t.after(() => {
    if (previousPlatform === undefined) delete process.env.NATIVEWIND_OS;
    else process.env.NATIVEWIND_OS = previousPlatform;
  });
  const config = load("../../tailwind.config.ts").default;
  const classes = [
    "bg-background",
    "bg-surface-2",
    "text-foreground",
    "text-muted",
    "border-border",
    "bg-primary",
    "text-primary-foreground",
    "min-h-control",
    "min-w-control",
    "rounded-xl",
    "text-title-2",
    "font-sans",
    "ios:font-sans-ios",
    ...Object.values(status.statusClasses).flatMap((value) => value.split(" ")),
  ];
  const result = await tailwindRequire("postcss")([
    require("tailwindcss")({
      ...config,
      content: [{ raw: classes.join(" "), extension: "tsx" }],
    }),
  ]).process("@tailwind utilities;", { from: undefined });
  for (const name of classes)
    assert.ok(
      result.css.includes("." + name.replaceAll(":", "\\:")),
      `Missing ${name}`,
    );
  assert.equal(config.theme.colors.background, tokens.colors.background);
  assert.equal(config.theme.colors.surface[2], tokens.colors.surface[2]);
  assert.equal(config.theme.spacing[5], "20px");
  assert.equal(config.theme.borderRadius.xl, "24px");
  assert.equal(config.theme.extend.minHeight.control, "48px");
  // A real native conversion, not just a Web-only stylesheet check.
  const compiled =
    require("react-native-css-interop/css-to-rn").cssToReactNativeRuntime(
      result.css,
    );
  assert.ok(Object.hasOwn(compiled.rules, "bg-background"));
  assert.ok(Object.hasOwn(compiled.rules, "min-h-control"));
  const stylesFor = (name) =>
    compiled.rules[name].n.flatMap((rule) => rule.d).flat();
  assert.ok(stylesFor("min-h-control").some((value) => value.minHeight === 48));
  assert.ok(stylesFor("rounded-xl").some((value) => value.borderRadius === 24));
  assert.ok(
    stylesFor("font-sans").some((value) => value.fontFamily === "sans-serif"),
  );
  assert.ok(
    stylesFor("ios:font-sans-ios").some(
      (value) => value.fontFamily === "System",
    ),
  );
  assert.ok(stylesFor("text-title-2").some((value) => value.fontSize === 24));
  for (const name of classes)
    assert.equal(
      compiled.rules[name].warnings?.length ?? 0,
      0,
      `${name} must be native-compatible`,
    );
});
