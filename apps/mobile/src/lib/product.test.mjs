import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const tw = createRequire(require.resolve("tailwindcss/package.json"));
const load = tw("jiti")(fileURLToPath(import.meta.url));
const p = load("./product.ts");
test("auth URLs resolve /api/auth for direct and reverse-proxied business APIs", () => {
  for (const base of ["http://localhost:3001", "http://localhost:3001/"])
    assert.equal(p.authEndpoint(base), "http://localhost:3001/api/auth");
  for (const base of [
    "https://chainpass.test/api",
    "https://chainpass.test/api/",
  ])
    assert.equal(p.authEndpoint(base), "https://chainpass.test/api/auth");
  assert.equal(
    p.authEndpoint("https://chainpass.test/gateway/api"),
    "https://chainpass.test/gateway/api/auth",
  );
});
test("server roles select one workspace; unknown roles never acquire privileges", () => {
  for (const [role, home] of [
    ["user", "/"],
    ["merchant", "/merchant"],
    ["admin", "/admin"],
  ])
    assert.equal(p.roleHome(p.getRole({ role })), home);
  assert.equal(p.getRole({ role: "superadmin" }), "user");
});
test("auth return paths enforce role boundaries and reject redirect/escape attacks", () => {
  assert.equal(p.authDestination("user", "/events/e1"), "/events/e1");
  assert.equal(p.authDestination("user", "/invite"), "/invite");
  assert.equal(p.authDestination("admin", "/invite"), "/invite");
  assert.equal(p.authDestination("merchant", "/invite"), "/merchant");
  assert.equal(p.authDestination("user", "/invite#token=secret"), "/");
  assert.equal(p.authDestination("user", "/my-passes/p1"), "/my-passes/p1");
  assert.equal(
    p.authDestination("admin", "/merchant/events/e1"),
    "/merchant/events/e1",
  );
  assert.equal(p.authDestination("merchant", "/admin/users"), "/merchant");
  for (const path of [
    "//evil.test",
    "https://evil.test",
    "/merchant",
    "/admin",
    "/events/../admin",
    "/events/%2e%2e",
    "/events/abc?next=//evil",
    "/events/abc\\def",
  ])
    assert.equal(p.authDestination("user", path), "/");
});
test("all private query keys isolate the identity and the resource", () => {
  for (const method of [
    "passes",
    "wallet",
    "merchantEvents",
    "adminEvents",
    "users",
  ]) {
    assert.equal(p.keys[method]("u1")[0], "private");
    assert.notDeepEqual(p.keys[method]("u1"), p.keys[method]("u2"));
  }
  for (const method of ["qr", "tickets", "managedEvent", "invitations"])
    assert.notDeepEqual(p.keys[method]("u1", "p1"), p.keys[method]("u1", "p2"));
});
test("QR cannot be displayed when expired, backgrounded or no longer active", () => {
  const exp = new Date(60_000).toISOString();
  assert.equal(p.qrState("ACTIVE", true, exp, 59_999), "ready");
  assert.equal(p.qrState("ACTIVE", true, exp, 60_000), "expired");
  assert.equal(p.qrState("ACTIVE", false, exp, 1), "paused");
  for (const state of ["REVOKED", "CHECKED_IN"])
    assert.equal(p.qrState(state, true, exp, 1), "disabled");
  assert.equal(p.qrState("ACTIVE", true, undefined, 1), "loading");
  assert.equal(p.qrState("ACTIVE", true, "invalid", 1), "expired");
  assert.equal(p.qrRefreshDelay(exp, 20_000), 30_000);
  assert.equal(p.qrRefreshDelay(exp, 60_000), 0);
});
test("camera only mounts while focused, foregrounded, authorized and scanning", () => {
  assert.equal(p.cameraShouldRun(true, true, true, true), true);
  for (const args of [
    [false, true, true, true],
    [true, false, true, true],
    [true, true, false, true],
    [true, true, true, false],
  ])
    assert.equal(p.cameraShouldRun(...args), false);
});
test("check-in requires both VALID and the server's canCheckIn", () => {
  assert.equal(
    p.canConfirmCheckIn({ verificationStatus: "VALID", canCheckIn: true }),
    true,
  );
  assert.equal(
    p.canConfirmCheckIn({ verificationStatus: "VALID", canCheckIn: false }),
    false,
  );
  for (const state of ["ALREADY_CHECKED_IN", "REVOKED", "INVALID"])
    assert.equal(
      p.canConfirmCheckIn({ verificationStatus: state, canCheckIn: true }),
      false,
    );
  assert.equal(p.canConfirmCheckIn(null), false);
});
test("wallet binding presentation requires an EVM address on Ethereum Sepolia", () => {
  const addr = "0xECd97d9A3fee1a726B48fd6E2635949E40C097aC";
  assert.equal(p.walletCanBind(addr, 11155111), true);
  assert.equal(p.walletCanBind(addr, "11155111"), true);
  assert.equal(p.walletCanBind(addr, 84532), false);
  assert.equal(p.walletCanBind("bad", 11155111), false);
  assert.equal(p.walletCanBind(undefined, 11155111), false);
});
