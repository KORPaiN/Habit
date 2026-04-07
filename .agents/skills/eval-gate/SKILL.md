---
name: eval-gate
description: Review a Habit implementation against written acceptance criteria and regression-sensitive product flows.
---

# Purpose
Use this skill after implementation.

The goal is not to decide whether the change looks good.
The goal is to decide whether it safely fits Habit’s current product and technical flow.

# Read first
- `README.md`
- the PRD or task brief
- the acceptance criteria
- the implementation summary
- changed files
- `package.json` if live browser verification or test commands are needed
- `lib/ai/index.ts` if AI changed
- `lib/supabase/habit-service.ts` if service flow changed

# If inputs are incomplete
If acceptance criteria are missing, do not invent broad success criteria.
Return a blocked or not-verifiable review outcome.

# Output format
Return exactly these sections:

1. Verdict
2. Requirement coverage
3. Defects found
4. UX issues
5. Risk assessment
6. Top fixes
7. Release recommendation

# Section rules

## 1. Verdict
Must be one of:
- pass
- conditional pass
- fail

## 2. Requirement coverage
For every acceptance criterion, mark:
- met
- partially met
- not met
- not verified

Add short evidence or notes.

## 3. Defects found
List concrete defects only.
For each defect include:
- title
- severity: high / medium / low
- what happens
- why it matters
- likely impact scope

## 4. UX issues
Only include user-facing issues that materially affect task completion, clarity, or pressure.

## 5. Risk assessment
Explicitly assess:
- onboarding regression risk
- today / recovery regression risk
- AI output contract risk
- service / data flow risk
- mobile readability risk

If UI or product flow changed, include whether live browser verification was completed, partially completed, blocked, or not applicable.

## 6. Top fixes
Recommend the smallest sufficient fixes.
Do not suggest roadmap features.

## 7. Release recommendation
Choose one:
- release
- release with caution
- do not release

Add a short justification.

# Habit-specific review rules

## If UI or product flow changed, explicitly check:
- homepage can be opened in a real browser when local tooling is available
- affected primary buttons, route links, form steps, and safe completion / recovery controls can be clicked
- regression-sensitive pages are checked when reachable: `/`, `/onboarding`, `/onboarding/review`, `/today`, `/recover`, `/review`, `/anchors`
- runtime errors, broken navigation, blocked submits, validation failures, console errors, mobile overflow, and unclear Korean copy
- exact blockers if authentication, environment variables, missing seed data, AI quota, unavailable browser tooling, or local server failures prevent verification

Do not mark a requested live browser verification as fully verified based only on static review.

## If AI changed, explicitly check:
- schema compliance
- fallback preservation
- retry / timeout preservation
- locale consistency
- safe micro-action constraints
- empty response handling

## If service flow changed, explicitly check:
- goal -> plan -> daily action flow
- anchor linkage
- selected candidate linkage
- completion / failure behavior
- weekly review impact

# General rules
- Review only against written requirements.
- Do not invent new requirements.
- Missing tests or unverifiable behavior are findings.
- Acceptance criteria outrank personal taste.
- Lead with evidence-based defects.
- If the user prompt is in Korean, the final output may be in Korean.
