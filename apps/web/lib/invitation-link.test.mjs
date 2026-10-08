import assert from "node:assert/strict";
import { test } from "node:test";
import { invitationLink, invitationTokenFromHash } from "./invitation-link.ts";

test("shareable invitation credentials never enter the path or query string", () => {
  const token = "A".repeat(43);
  const link = new URL(invitationLink("https://chainpass.test", token));
  assert.equal(link.pathname, "/invite");
  assert.equal(link.search, "");
  assert.equal(invitationTokenFromHash(link.hash), token);
});
test("malformed, duplicate and unrelated fragment credentials are rejected", () => {
  for (const value of [
    "",
    "#token=bad",
    "#session=secret",
    "#token=" + "A".repeat(43) + "&token=" + "B".repeat(43),
  ]) {
    assert.equal(invitationTokenFromHash(value), null);
  }
});
