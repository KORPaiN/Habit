# AGENTS.md

## Project
This project is a web-based habit-building service for people who struggle to start habits.
The product is not a generic habit tracker. It is an execution-focused micro-habit coach.

## Product goal
Turn a large goal into one tiny action the user can do today in 1–5 minutes.
The key product loop is:
1. user enters a goal
2. system breaks it into micro-actions
3. user selects today's one small action
4. if they fail, system makes it even smaller
5. weekly review summarizes patterns

## Tech stack
- Next.js (App Router)
- TypeScript
- Tailwind CSS
- Supabase
- Zod for validation
- OpenAI API for habit decomposition
- Use server actions or route handlers when appropriate

## UX principles
- Reduce pressure
- Show one primary action per screen
- Never shame the user
- Failure should lead to redesign, not guilt
- Copy should be short, calm, and concrete

## Core MVP scope
Implement only these first:
- landing page
- auth screens
- onboarding (goal, difficulty, available time, anchor)
- AI-generated micro-action plan
- today action screen
- failure recovery flow
- weekly review summary

## Data rules
- one user can have many goals
- one goal can have many plan versions
- one plan has up to 3 micro-actions
- one daily action per goal per date
- fallback action is required

## AI rules
The model must:
- return JSON only
- generate actions that take 1–5 minutes
- avoid vague actions like “do your best”
- prefer observable actions
- generate a fallback action
- make actions smaller when user reports failure

## Coding rules
- Keep components small and reusable
- Use clear folder structure
- Validate all request payloads
- Add loading/error/empty states
- Add basic tests for pure utility functions
- Do not over-engineer
- Prefer readable code over clever code

## Deliverables
For each task:
1. explain the plan briefly
2. implement the code
3. list files changed
4. note anything incomplete