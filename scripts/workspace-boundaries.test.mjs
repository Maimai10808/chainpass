import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (file) =>
  readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const manifest = (file) => JSON.parse(read(file));
const platforms = [
  "telegram-mini",
  "telegram-bot",
  "extension",
  "discord-bot",
  "wechat-mini",
];
const core = [
  "web",
  "api",
  "mobile",
  "@chainpass/api-client",
  "@chainpass/schemas",
  "@chainpass/web3",
  "@chainpass/config",
];

test("default Turbo task graph remains limited to the existing core workspaces", () => {
  for (const task of ["dev", "build", "lint", "typecheck", "test"]) {
    const script = manifest("package.json").scripts[task];
    const filters = [...script.matchAll(/--filter=(?:'([^']+)'|(\S+))/g)].map(
      (match) => `--filter=${match[1] ?? match[2]}`,
    );
    assert.ok(
      filters.length > 0,
      `${task} must explicitly scope its task graph`,
    );
    const result = spawnSync(
      "pnpm",
      ["exec", "turbo", "run", task, ...filters, "--dry=json"],
      {
        cwd: root,
        encoding: "utf8",
        timeout: 30_000,
      },
    );
    assert.equal(result.status, 0, result.stderr);
    const graph = JSON.parse(result.stdout);
    assert.deepEqual([...graph.packages].sort(), [...core].sort());
    assert.ok(graph.tasks.every((entry) => core.includes(entry.package)));
  }
});

test("experimental applications have private identities and real check commands", () => {
  for (const platform of platforms) {
    const app = manifest(`apps/${platform}/package.json`);
    assert.equal(app.name, `@chainpass/${platform}`);
    assert.equal(app.private, true);
    for (const task of ["dev", "build", "lint", "typecheck"]) {
      assert.ok(app.scripts[task], `${platform}: missing ${task}`);
    }
    assert.ok(
      !Object.values(app.scripts).some((script) =>
        script.includes("no test specified"),
      ),
    );
    assert.equal(
      app.scripts.prepare,
      undefined,
      "app setup must not install root Git hooks",
    );
  }
});

test("production build context excludes experimental application directories", () => {
  const ignored = read(".dockerignore").split(/\r?\n/);
  for (const platform of platforms)
    assert.ok(ignored.includes(`apps/${platform}`));
  for (const app of ["api", "web"]) {
    const dockerfile = read(`apps/${app}/Dockerfile`);
    assert.ok(dockerfile.includes(`turbo prune ${app} --docker`));
    assert.ok(
      platforms.every((platform) => !dockerfile.includes(`apps/${platform}`)),
    );
    const dependencies = manifest(`apps/${app}/package.json`).dependencies;
    assert.ok(
      platforms.every(
        (platform) => dependencies[`@chainpass/${platform}`] === undefined,
      ),
    );
  }
});

test("extension scaffold requests neither content script access nor background execution", () => {
  assert.ok(!read("apps/extension/wxt.config.ts").includes("host_permissions"));
  for (const entry of ["content.ts", "background.ts"]) {
    assert.equal(
      existsSync(
        new URL(`../apps/extension/entrypoints/${entry}`, import.meta.url),
      ),
      false,
    );
  }
});
