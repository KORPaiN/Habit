import test from "node:test";
import assert from "node:assert/strict";

import { buildAnchorLabel, minutesLabel, shrinkAction } from "@/lib/utils/habit";

test("minutesLabel formats singular and plural labels", () => {
  assert.equal(minutesLabel(1), "1분");
  assert.equal(minutesLabel(3), "3분");
});

test("buildAnchorLabel returns calm anchor copy", () => {
  assert.equal(buildAnchorLabel("before-bed"), "잠들기 전");
});

test("shrinkAction reduces duration but keeps fallback", () => {
  const action = shrinkAction({
    title: "Write one sentence",
    reason: "Start the loop",
    durationMinutes: 2,
    fallbackAction: "Write three words",
  });

  assert.equal(action.durationMinutes, 1);
  assert.equal(action.fallbackAction, "Write three words");
});
