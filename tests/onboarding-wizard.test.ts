import test from "node:test";
import assert from "node:assert/strict";

import { parseWizardStep, resolveWizardStep } from "@/lib/utils/onboarding-wizard";

test("parseWizardStep accepts only valid onboarding steps", () => {
  assert.equal(parseWizardStep(1), 1);
  assert.equal(parseWizardStep(5), 5);
  assert.equal(parseWizardStep(0), undefined);
  assert.equal(parseWizardStep(6), undefined);
});

test("resolveWizardStep prefers the explicit resume step over a stale draft step", () => {
  assert.equal(
    resolveWizardStep({
      resumeStep: 4,
      resumeDraft: true,
      draftStep: 1,
    }),
    4,
  );
});

test("resolveWizardStep ignores a stale draft when onboarding starts fresh", () => {
  assert.equal(
    resolveWizardStep({
      draftStep: 3,
    }),
    1,
  );
});

test("resolveWizardStep restores the draft only when resume mode is enabled", () => {
  assert.equal(
    resolveWizardStep({
      resumeDraft: true,
      draftStep: 3,
    }),
    3,
  );
});

test("resolveWizardStep keeps review mode on the final step", () => {
  assert.equal(
    resolveWizardStep({
      resumeStep: 2,
      draftStep: 3,
      isReviewMode: true,
    }),
    5,
  );
});
