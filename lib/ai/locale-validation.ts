import type { Locale } from "@/lib/locale";
import type { HabitDecomposition, MicroAction } from "@/lib/validators/habit";

const hangulPattern = /[\uac00-\ud7a3]/;
const latinPattern = /[A-Za-z]/;

function stripUserGoal(value: string, goal: string) {
  if (!goal.trim()) {
    return value;
  }

  return value.split(goal).join(" ");
}

function hasExpectedScript(value: string, locale: Locale) {
  return locale === "ko" ? hangulPattern.test(value) : latinPattern.test(value);
}

function hasWrongScript(value: string, locale: Locale) {
  return locale === "ko" ? latinPattern.test(value) : hangulPattern.test(value);
}

export function isLocalizedString(value: string, locale: Locale, goal: string) {
  const normalized = stripUserGoal(value, goal).trim();

  if (!normalized) {
    return true;
  }

  if (!hasExpectedScript(normalized, locale)) {
    return false;
  }

  return !hasWrongScript(normalized, locale);
}

export function validateDecompositionLocale(
  decomposition: Omit<HabitDecomposition, "source">,
  input: { goal: string },
  locale: Locale,
) {
  const actionFields = decomposition.microActions.flatMap((action: MicroAction) => [
    action.title,
    action.reason,
    action.fallbackAction,
  ]);

  const values = [
    decomposition.goalSummary,
    decomposition.selectedAnchor,
    decomposition.todayAction.title,
    decomposition.todayAction.reason,
    decomposition.todayAction.fallbackAction,
    decomposition.fallbackAction,
    ...actionFields,
  ];

  const invalidValue = values.find((value) => !isLocalizedString(value, locale, input.goal));

  if (invalidValue) {
    throw new Error(`OpenAI response contained text outside the requested ${locale} locale.`);
  }
}
