import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const tw = createRequire(require.resolve("tailwindcss/package.json"));
const load = tw("jiti")(fileURLToPath(import.meta.url));
const links = load("./invitation-link.ts");
const {
  createPendingInvitationStore,
  readPendingInvitation,
  PENDING_INVITATION_RETENTION_MS: ttl,
} = load("./pending-invitation-store.ts");
const a = "a".repeat(43),
  b = "b".repeat(43);
const origin = "https://chainpass.test";
function storage(initial = null) {
  let raw = initial;
  return {
    read: async () => raw,
    write: async (value) => {
      raw = value;
    },
    remove: async () => {
      raw = null;
    },
  };
}
test("Web and installed-app links carry the same token in a fragment", () => {
  const web = links.invitationLink(origin, a);
  assert.equal(web, `${origin}/invite#token=${a}`);
  assert.equal(new URL(web).search, "");
  assert.equal(links.invitationTokenFromLink(web, origin), a);
  assert.equal(
    links.invitationTokenFromLink(links.nativeInvitationLink(a), origin),
    a,
  );
});
test("malformed, duplicate, wrong-origin and dangerous links are rejected", () => {
  for (const link of [
    `${origin}/invite?token=${a}`,
    `${origin}/invite#token=${a}&token=${b}`,
    `${origin}/events/one#token=${a}`,
    `${origin}/invite#token=short`,
    `https://other.test/invite#token=${a}`,
    `https://u:p@chainpass.test/invite#token=${a}`,
    `chainpass://merchant#token=${a}`,
    `chainpass://invite/extra#token=${a}`,
    `javascript:alert(1)`,
    `not a link`,
  ])
    assert.equal(links.invitationTokenFromLink(link, origin), null);
  assert.throws(() => links.invitationLink("file:///tmp", a));
  assert.throws(() => links.invitationLink(origin, "bad"));
});
test("stored handoffs validate shape, expiry, future timestamps and retention", () => {
  const value = {
    token: a,
    storedAt: 1000,
    expiresAt: new Date(3000).toISOString(),
  };
  assert.deepEqual(readPendingInvitation(JSON.stringify(value), 2000), value);
  assert.equal(readPendingInvitation(JSON.stringify(value), 3000), null);
  for (const raw of [
    "bad",
    "null",
    JSON.stringify({ ...value, token: "bad" }),
    JSON.stringify({ ...value, storedAt: "1000" }),
    JSON.stringify({ ...value, expiresAt: "bad" }),
  ])
    assert.equal(readPendingInvitation(raw, 2000), null);
  assert.equal(readPendingInvitation(JSON.stringify(value), 999), null);
  assert.equal(
    readPendingInvitation(
      JSON.stringify({ token: a, storedAt: 1000 }),
      1000 + ttl,
    ),
    null,
  );
});
test("cold restore loads a saved credential but never trusts its business eligibility", async () => {
  const memory = storage();
  const first = createPendingInvitationStore(memory, () => 1000);
  await first.accept(a);
  const restored = createPendingInvitationStore(memory, () => 2000);
  await restored.hydrate();
  assert.equal(restored.getSnapshot().value.token, a);
  assert.equal(restored.getSnapshot().ready, true);
  // Eligibility is still checked by resolveInvitation/claim, not by this store.
});
test("a delayed hydration cannot overwrite a newly opened invitation", async () => {
  let release;
  const disk = storage(JSON.stringify({ token: a, storedAt: 1000 }));
  const store = createPendingInvitationStore(
    {
      ...disk,
      read: () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    },
    () => 2000,
  );
  const hydration = store.hydrate();
  await Promise.resolve();
  const accept = store.accept(b);
  release(JSON.stringify({ token: a, storedAt: 1000 }));
  await Promise.all([hydration, accept]);
  assert.equal(store.getSnapshot().value.token, b);
  assert.equal(JSON.parse(await disk.read()).token, b);
});
test("invalid new invitation clears an old credential instead of falling back", async () => {
  const disk = storage();
  const store = createPendingInvitationStore(disk, () => 1000);
  await store.accept(a);
  await store.accept(null);
  assert.equal(store.getSnapshot().value, null);
  assert.equal(store.getSnapshot().reason, "invalid");
  assert.equal(await disk.read(), null);
});
test("replacements and logout deletes are serialized; cleared tokens cannot reappear", async () => {
  const disk = storage();
  const store = createPendingInvitationStore(disk, () => 1000);
  await Promise.all([store.accept(a), store.accept(b), store.clear()]);
  assert.equal(store.getSnapshot().value, null);
  assert.equal(await disk.read(), null);
});
test("expiry update cannot attach the previous invitation metadata to a new link", async () => {
  const store = createPendingInvitationStore(storage(), () => 1000);
  await store.accept(a);
  await store.accept(b);
  await store.setExpiry(a, new Date(2000).toISOString());
  assert.equal(store.getSnapshot().value.token, b);
  assert.equal(store.getSnapshot().value.expiresAt, undefined);
  await store.setExpiry(b, new Date(999).toISOString());
  assert.equal(store.getSnapshot().reason, "expired");
  assert.equal(store.getSnapshot().value, null);
});
test("storage failure is contained and an in-memory auth handoff still works", async () => {
  const failure = async () => {
    throw new Error("storage unavailable");
  };
  const store = createPendingInvitationStore(
    { read: failure, write: failure, remove: failure },
    () => 1000,
  );
  await store.hydrate();
  assert.equal(store.getSnapshot().ready, true);
  await store.accept(a);
  assert.equal(store.getSnapshot().value.token, a);
  assert.equal(store.getSnapshot().persistent, false);
  await store.clear();
  assert.equal(store.getSnapshot().value, null);
});
test("expired/corrupt persistence is deleted during hydration", async () => {
  for (const initial of ["bad", JSON.stringify({ token: a, storedAt: 0 })]) {
    const disk = storage(initial);
    const store = createPendingInvitationStore(disk, () => ttl + 1);
    await store.hydrate();
    assert.equal(store.getSnapshot().value, null);
    assert.equal(await disk.read(), null);
  }
});
