---
name: prompt-contract
description: Define or review the AI contract for Habit features that depend on structured output, validation, retry, timeout, or fallback logic.
---

# Purpose
Use this skill when a Habit change touches AI-driven behavior.

Habit already depends on:
- structured JSON output
- schema validation
- retry behavior
- timeout handling
- rule-based fallback
- locale-sensitive output

This skill exists to prevent fragile prompt changes from breaking product behavior.

# Read first
- `lib/ai/index.ts`
- `README.md`

# Common touchpoints
Use this skill when touching:
- `generateBehaviorSwarm`
- `generateHabitDecomposition`
- `generateHabitDecompositionFromSelection`
- any route or service that parses structured AI output

# Output format
Return exactly these sections:

1. Use case
2. Current touchpoint
3. Input contract
4. Output contract
5. Validation rules
6. Retry / timeout rules
7. Fallback rules
8. Failure modes
9. Minimal verification cases

# Section rules

## 1. Use case
Describe what the model is responsible for in this feature.

Examples:
- behavior swarm generation
- selected behavior plan generation
- recovery rewrite
- decomposition rewrite

## 2. Current touchpoint
State which function or layer is being changed.

## 3. Input contract
Define:
- required fields
- optional fields
- constraints
- locale expectations
- how invalid input should be handled

## 4. Output contract
Define the exact structure the code expects.
Include:
- root object
- required keys
- allowed types
- enum values if relevant
- length limits if relevant
- whether extra keys are allowed

Prefer strict, auditable structure.

## 5. Validation rules
State what must be validated immediately after model output.

Examples:
- JSON parse succeeds
- required keys exist
- locale is correct
- duration is in safe range
- fallback action exists
- candidate count is in allowed range

## 6. Retry / timeout rules
Define:
- when to retry
- maximum retry count
- what timeout means
- what to return on timeout
- when to stop retrying

## 7. Fallback rules
This section is required for Habit.

State how safe fallback behaves if AI fails.
Examples:
- rule-based fallback
- safe draft fallback
- locale-safe fallback
- minimal-action fallback

## 8. Failure modes
List likely failures such as:
- malformed JSON
- missing field
- off-locale output
- empty output
- timeout
- hallucinated key
- action too large
- missing fallback action

For each failure, state:
- how to detect it
- what the product should do next

## 9. Minimal verification cases
List the smallest useful checks for Builder or Reviewer.

Must include:
- happy path
- malformed output
- timeout
- fallback path
- locale-sensitive case

# Rules
- Preserve schema-based structure.
- Preserve fallback behavior.
- Do not remove retry or timeout safeguards unless explicitly required.
- Distinguish model failure from product logic failure.
- Prefer small, reviewable contracts.
- If the user prompt is in Korean, the final output may be in Korean.
