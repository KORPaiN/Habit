import test from "node:test";
import assert from "node:assert/strict";

import { buildAnchorReminder, buildRecipeText, minutesLabel, shrinkAction } from "@/lib/utils/habit";

test("minutesLabel formats Korean minute labels", () => {
  assert.equal(minutesLabel(1), "1분");
  assert.equal(minutesLabel(3), "3분");
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

test("buildRecipeText composes a short Korean recipe", () => {
  assert.equal(buildRecipeText("커피 마신 뒤", "책 한 페이지만 읽기"), "커피 마신 뒤 책 한 페이지만 읽기");
});

test("buildAnchorReminder returns the primary habit only", () => {
  assert.equal(buildAnchorReminder("커피 마신 뒤"), "기존 습관: 커피 마신 뒤");
});
