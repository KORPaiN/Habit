# AGENTS.md

## Project mission
This repository builds Habit, a Korean-first micro-habit coaching web app.

Habit is not a generic habit tracker.
It helps users reduce a large goal into one very small, observable action they can do today.

Optimize for:
- low-friction UX
- calm and concrete copy
- safe, small changes
- predictable AI behavior
- minimal regression risk

## Read first
Before proposing or implementing non-trivial changes, read:

1. `README.md`
2. `app/onboarding/page.tsx`
3. `lib/ai/index.ts`
4. `lib/supabase/habit-service.ts`
5. `package.json`

## Working model
Use separate roles:
- Planner
- Builder
- Reviewer

Do not perform Planner, Builder, and Reviewer work in a single pass unless explicitly requested.

## Output language
- Internal config files may stay in English.
- When the user writes prompts in Korean, respond in Korean unless explicitly asked otherwise.
- Product copy should remain Korean-first unless the task explicitly changes localization behavior.

## Product guardrails
- Do not turn Habit into a broad habit tracker.
- Keep each screen cognitively light, especially on mobile.
- Prefer extending existing flows over inventing new product surfaces.
- Keep copy short, calm, specific, and low-pressure.
- Preserve the “tiny action first” principle.

## Current critical flows
Treat these as regression-sensitive flows:
- onboarding
- onboarding review
- today
- recovery
- weekly/monthly review
- anchor reuse
- plan generation
- daily action completion / failure

## Architecture guardrails
- Do not silently change API contracts, DB assumptions, or AI output structure.
- Do not bypass Zod validation.
- Do not remove fallback behavior, retry handling, timeout handling, or locale safeguards from AI features.
- Do not mix feature expansion into a bug fix.
- Prefer the smallest safe diff.

## AI rules
If a task touches `lib/ai/index.ts` or AI generation flow:
- preserve structured JSON assumptions
- preserve schema validation
- preserve fallback behavior
- preserve retry and timeout handling
- preserve locale consistency
- distinguish model failure from product logic failure

## Service-layer rules
If a task touches `lib/supabase/habit-service.ts` or related API routes:
- preserve goal -> plan -> daily action flow
- preserve anchor sync behavior
- preserve selected behavior / swarm candidate linkage
- preserve weekly review behavior
- explicitly call out migration-like changes

## Required handoff artifacts

### Planner handoff
1. Problem
2. User value
3. Entry point in current Habit flow
4. MVP scope
5. Non-goals
6. Impacted files
7. Acceptance criteria
8. Risks
9. Builder handoff notes

### Builder handoff
1. Changed files
2. Implementation summary
3. Verification steps
4. Known limitations

### Reviewer handoff
1. Verdict
2. Requirement coverage
3. Defects
4. Risks
5. Top fixes
6. Release recommendation

## Verification defaults
Prefer these when relevant:
- `npm run build`
- `npx tsc --noEmit`
- `npm test`

If UI or product flow is touched, include manual verification steps.

## Definition of done
A task is done only when:
- requested scope is implemented
- acceptance criteria were checked
- major regression risks are called out
- the next human can understand what changed
- the next human can verify the change without guessing
