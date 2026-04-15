---
name: product-prd
description: Turn a rough Habit feature idea into a small MVP brief that fits the current onboarding, review, today, or recovery flow.
---

# Purpose
Use this skill when a new Habit feature request is broad, vague, or likely to create scope creep.

The goal is not to invent a parallel product.
The goal is to define the smallest safe MVP that fits the current Habit experience.

# Read first
- `README.md`
- `app/onboarding/page.tsx`
- `lib/ai/index.ts`
- `lib/supabase/habit-service.ts`

# Output format
Return exactly these sections:

1. Problem
2. User value
3. Entry point in current Habit flow
4. MVP scope
5. Non-goals
6. Impacted files
7. Acceptance criteria
8. Risks
9. Builder handoff notes

# Section rules

## 1. Problem
Describe one primary user problem in plain language.

## 2. User value
Explain why this matters for Habit users now.

## 3. Entry point in current Habit flow
Choose the best fit:
- onboarding
- onboarding review
- today
- recovery
- weekly/monthly review
- anchors
- service/backend-only

Explain briefly why it belongs there.

## 4. MVP scope
List the smallest useful feature scope.
Prefer extending an existing flow over creating a large new surface.

## 5. Non-goals
Be strict.
List what is explicitly out of scope for this iteration.

## 6. Impacted files
List the smallest realistic set of impacted files.
Examples:
- `app/...`
- `components/...`
- `lib/ai/index.ts`
- `lib/supabase/habit-service.ts`
- `tests/...`

## 7. Acceptance criteria
Each criterion must be concrete and testable.

Bad:
- feels clearer
- should work better

Good:
- user can complete X without leaving flow Y
- AI output is validated before plan creation
- Today still renders fallback action after this change

## 8. Risks
Call out risks such as:
- onboarding regression risk
- AI output contract risk
- service flow risk
- mobile UX risk
- copy confusion risk

## 9. Builder handoff notes
Include:
- what must be preserved
- what should not be touched
- which flow is most sensitive
- whether AI/service/schema behavior is involved

# Rules
- Habit is not a generic habit tracker.
- Preserve tiny-action and low-pressure design principles.
- Do not write production code.
- Prefer one focused improvement over several loosely related changes.
- If the request touches AI generation, state that explicitly.
- If the user prompt is in Korean, the final output may be in Korean.
