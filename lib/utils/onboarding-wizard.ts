export const ONBOARDING_STEP_COUNT = 5;

export function parseWizardStep(step?: number | null) {
  if (!Number.isInteger(step) || !step || step < 1 || step > ONBOARDING_STEP_COUNT) {
    return undefined;
  }

  return step;
}

export function resolveWizardStep(options: {
  resumeStep?: number;
  draftStep?: number;
  resumeDraft?: boolean;
  isReviewMode?: boolean;
  isReselect?: boolean;
  hasSwarmCandidates?: boolean;
}) {
  if (options.isReviewMode) {
    return ONBOARDING_STEP_COUNT;
  }

  if (options.isReselect) {
    return options.hasSwarmCandidates ? 3 : 1;
  }

  return parseWizardStep(options.resumeStep) ?? (options.resumeDraft ? parseWizardStep(options.draftStep) : undefined) ?? 1;
}
