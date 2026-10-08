import assert from "node:assert/strict";
import { test } from "node:test";
import { getRole, roleHome, loginDestination } from "./navigation.ts";

test("roles have stable landing pages and unknown roles receive no elevated UI", () => {
  assert.equal(roleHome("user"), "/events");
  assert.equal(roleHome("merchant"), "/merchant");
  assert.equal(roleHome("admin"), "/admin");
  assert.equal(getRole("superuser"), "user");
});

test("next redirects retain authorized local paths and query strings", () => {
  assert.equal(loginDestination("user", "/invite"), "/invite");
  assert.equal(loginDestination("merchant", "/invite"), "/invite");
  assert.equal(
    loginDestination("user", "/invite?token=must-not-leak#token=must-not-leak"),
    "/invite",
  );
  assert.equal(
    loginDestination("user", "/events/abc?ticket=general"),
    "/events/abc?ticket=general",
  );
  assert.equal(loginDestination("user", "/my-passes/abc"), "/my-passes/abc");
  assert.equal(
    loginDestination("merchant", "/merchant/check-in"),
    "/merchant/check-in",
  );
  assert.equal(
    loginDestination("admin", "/merchant/events/abc"),
    "/merchant/events/abc",
  );
  assert.equal(loginDestination("admin", "/admin/users"), "/admin/users");
});

test("next redirects cannot bypass roles or leave the application", () => {
  for (const value of [
    "/merchant",
    "/admin/users",
    "https://evil.invalid",
    "//evil.invalid",
    "/%2Fevil.invalid",
    "/%5Cevil.invalid",
    "/\\evil.invalid",
    "/login",
    "/events/../../admin",
    "%2Fevents",
    "/%not-valid",
  ]) {
    assert.equal(loginDestination("user", value), "/events", value);
  }
  assert.equal(loginDestination("merchant", "/admin/users"), "/merchant");
});
