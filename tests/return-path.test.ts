import test from "node:test";
import assert from "node:assert/strict";

import { buildAnchorsPath, sanitizeReturnPath } from "@/lib/utils/return-path";

test("sanitizeReturnPath keeps safe relative paths", () => {
  assert.equal(sanitizeReturnPath("/onboarding?step=4&resume=1"), "/onboarding?step=4&resume=1");
});

test("sanitizeReturnPath rejects external paths", () => {
  assert.equal(sanitizeReturnPath("https://example.com/hijack"), "/onboarding");
  assert.equal(sanitizeReturnPath("//example.com/hijack"), "/onboarding");
});

test("buildAnchorsPath preserves the return path and status flags", () => {
  assert.equal(
    buildAnchorsPath({
      returnTo: "/onboarding?step=4&resume=1",
      saved: true,
    }),
    "/anchors?returnTo=%2Fonboarding%3Fstep%3D4%26resume%3D1&saved=1",
  );
});
