import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import { getMotionTransition, motionDuration, motionSpring } from "./motion.ts";
import { getStatusClasses, statusClasses, statusTone } from "./status.ts";

const require = createRequire(import.meta.url);
const tailwind = require("@tailwindcss/postcss");
const postcss = require(
  require.resolve("postcss", {
    paths: [dirname(require.resolve("@tailwindcss/postcss"))],
  }),
);
const cssPath = fileURLToPath(
  new URL("../../app/globals.css", import.meta.url),
);
const css = await readFile(cssPath, "utf8");
const values = new Map();
postcss.parse(css).walkRules(":root", (rule) => {
  rule.walkDecls((decl) => values.set(decl.prop, decl.value));
});

function color(token) {
  const value = values.get(token);
  assert.ok(value, `Missing ${token}`);
  const alias = /^var\((--[\w-]+)\)$/.exec(value);
  return alias ? color(alias[1]) : value;
}

function luminance(hex) {
  assert.match(hex, /^#[a-f\d]{6}$/i);
  const channels = hex
    .slice(1)
    .match(/../g)
    .map((v) => {
      const channel = parseInt(v, 16) / 255;
      return channel <= 0.04045
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4;
    });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

test("shadcn aliases and normal text pairs have accessible contrast", () => {
  assert.equal(color("--card"), color("--surface-1"));
  assert.equal(color("--input"), color("--border"));
  const pairs = [
    ["--foreground", "--background"],
    ["--muted-foreground", "--surface-3"],
    ["--card-foreground", "--card"],
    ["--popover-foreground", "--popover"],
    ["--primary-foreground", "--primary"],
    ["--primary", "--surface-3"],
    ...["success", "warning", "danger", "info", "neutral"].map((tone) => [
      `--${tone}-foreground`,
      `--${tone}`,
    ]),
  ];
  for (const [foreground, background] of pairs) {
    const a = luminance(color(foreground));
    const b = luminance(color(background));
    const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    assert.ok(ratio >= 4.5, `${foreground}/${background}: ${ratio.toFixed(2)}`);
  }
});

test("business states are presentation-only mappings with neutral fallback", () => {
  assert.deepEqual(statusTone, {
    ACTIVE: "success",
    PUBLISHED: "success",
    DRAFT: "neutral",
    PENDING: "warning",
    MINTING: "violet",
    ON_CHAIN: "info",
    ON_CHAIN_VERIFIED: "info",
    CHECKED_IN: "info",
    REVOKED: "danger",
    ERROR: "danger",
  });
  for (const [status, tone] of Object.entries(statusTone)) {
    assert.equal(getStatusClasses(status), statusClasses[tone]);
  }
  assert.equal(getStatusClasses("UNKNOWN"), statusClasses.neutral);
  assert.equal(getStatusClasses("toString"), statusClasses.neutral);
});

test("motion vocabulary uses seconds and can opt out of movement", () => {
  assert.deepEqual(motionDuration, {
    fast: 0.12,
    normal: 0.2,
    slow: 0.32,
    dramatic: 0.5,
  });
  assert.deepEqual(Object.keys(motionSpring), ["snappy", "smooth"]);
  assert.deepEqual(getMotionTransition(true, "smooth"), { duration: 0 });
  assert.deepEqual(getMotionTransition(false, "smooth"), motionSpring.smooth);
});

test("Tailwind compiles semantic tokens and all opt-in foundation utilities", async () => {
  const utilities = [
    "bg-background",
    "text-foreground",
    "bg-card",
    "border-input",
    "ring-ring",
    "bg-surface-1",
    "border-border-subtle",
    "border-border-strong",
    "text-display",
    "text-h1",
    "text-h2",
    "text-h3",
    "text-body",
    "text-body-sm",
    "text-caption",
    "text-label",
    "text-mono",
    "font-mono",
    "rounded-lg",
    "rounded-xl",
    "p-card",
    "gap-compact",
    "px-page",
    "shadow-sm",
    "shadow-md",
    "brand-gradient",
    "text-gradient",
    "glass",
    "glow-subtle",
    "glow-brand",
    "disabled-opacity",
    "z-base",
    "z-sticky",
    "z-dropdown",
    "z-overlay",
    "z-modal",
    "z-toast",
  ];
  const result = await postcss([
    tailwind({ base: dirname(dirname(cssPath)) }),
  ]).process(`${css}\n@source inline("${utilities.join(" ")}");`, {
    from: cssPath,
  });
  const selectors = new Set();
  postcss.parse(result.css).walkRules((rule) => selectors.add(rule.selector));
  for (const utility of utilities)
    assert.ok(selectors.has(`.${utility}`), utility);
  assert.ok(result.css.includes("prefers-color-scheme") === false);
  assert.ok(result.css.includes("forced-colors: active"));
});

test("Base UI tabs forward orientation and style its actual data attribute", async () => {
  const tabs = await readFile(
    new URL("../../components/ui/tabs.tsx", import.meta.url),
    "utf8",
  );
  assert.match(tabs, /orientation=\{orientation\}/);
  assert.ok(tabs.includes("data-[orientation=horizontal]:flex-col"));
  assert.ok(tabs.includes("group-data-[orientation=vertical]/tabs:flex-col"));
  assert.equal(
    /(?:group-)?data-horizontal:|(?:group-)?data-vertical\//.test(tabs),
    false,
  );
  const result = await postcss([
    tailwind({ base: dirname(dirname(cssPath)) }),
  ]).process(
    `${css}\n@source inline("data-[orientation=horizontal]:flex-col group-data-[orientation=vertical]/tabs:flex-col");`,
    { from: cssPath },
  );
  assert.ok(result.css.includes('[data-orientation="horizontal"]'));
  assert.ok(result.css.includes('[data-orientation="vertical"]'));
});
