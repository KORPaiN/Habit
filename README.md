# Habit

Habit은 시작이 어려운 사람을 위한 마이크로 습관 코치입니다.  
큰 목표를 바로 추적하지 않고, 오늘 바로 할 수 있는 1개의 아주 작은 행동으로 줄여 실행하게 돕습니다.

## 제품 방향

- 일반적인 habit tracker가 아닙니다.
- 목표를 1~5분 안에 할 수 있는 행동으로 줄입니다.
- 실패는 죄책감이 아니라 재설계 신호로 다룹니다.
- 한 화면에는 한 가지 핵심 행동만 보여줍니다.
- 문구는 짧고, 차분하고, 구체적으로 유지합니다.

## 현재 구현 범위

### 온보딩

- 5단계 위저드
- 목표, 원하는 변화, 이유 입력
- behavior swarm 후보 6~10개 생성
- golden behavior 1개 선택
- primary anchor 1개 + backup anchor 최대 2개 선택
- recipe, celebration, rehearsal 설정
- 로컬 스토리지로 위저드 임시 저장

### 리뷰

- 최종 habit recipe 요약
- 원하는 변화
- 선택한 행동
- primary / backup anchor
- recipe
- fallback action
- celebration
- rehearsal progress
- `더 쉽게`, `조금 더 크게`, `다시 만들기` 보조 조정

### Today

- 오늘의 행동 1개
- recipe 표시
- fallback action 표시
- anchor reminder 표시
- 완료 후 celebration 표시

### Recovery

- `forgot`: cue 더 잘 보이게, anchor reminder 강화
- `too_big`: 더 작은 행동으로 축소
- `forgot_often`: backup anchor 재선택, rehearsal 다시
- `not_wanted`: 행동 축소 대신 behavior selection으로 복귀

### 기타

- saved anchors 재사용
- Supabase 기반 데이터 저장
- OpenAI Responses API + 규칙 기반 fallback
- Zod 검증
- 기본 테스트 포함

## 기술 스택

- Next.js App Router
- TypeScript
- React
- Tailwind CSS
- Supabase
- Zod
- OpenAI Responses API

## 로컬 실행

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

프로젝트 루트에 `.env.local` 파일을 만듭니다.

필수:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
```

권장:

```env
OPENAI_MODEL=
```

선택:

```env
OPENAI_MODEL_FAST=
OPENAI_MODEL_QUALITY=
OPENAI_MODEL_EXPERIMENTAL=
OPENAI_TIMEOUT_MS=
OPENAI_GENERATION_STRATEGY=
AI_REWRITE_ENABLED=
APP_USER_ID=
APP_USER_EMAIL=
APP_USER_NAME=
APP_USER_TIMEZONE=
```

### 3. 데이터베이스 반영

`supabase/schema.sql`은 현재 스냅샷입니다.  
실제 반영은 `supabase/migrations`의 SQL을 순서대로 적용하면 됩니다.

현재 migration:

- `20260327190000_initial_schema.sql`
- `20260327235900_default_locale_ko.sql`
- `20260328103000_add_notification_preferences_example.sql`
- `20260328113000_add_user_locale.sql`
- `20260328123000_reuse_existing_anchors.sql`
- `20260328140000_habit_v1_wizard.sql`

마지막 migration에는 아래 변경이 포함됩니다.

- `goals.desired_outcome`
- `goals.motivation_note`
- `goal_anchors`
- `behavior_swarm_candidates`
- `habit_plans.recipe_text`
- `habit_plans.celebration_text`
- `habit_plans.rehearsal_count`
- `habit_plans.selected_candidate_id`
- `failure_reason` enum 확장

### 4. 개발 서버 실행

```bash
npm run dev
```

기본 포트는 `3002`입니다.

## 주요 페이지

- `/` 랜딩
- `/login` 로그인
- `/signup` 회원가입
- `/onboarding` 5단계 온보딩 위저드
- `/onboarding/review` 최종 habit recipe 리뷰
- `/today` 오늘의 행동
- `/recover` 실패 후 재설계
- `/review` 월간 리뷰
- `/anchors` saved anchors 관리

## 주요 API

- `POST /api/onboarding` 온보딩 저장 + 첫 plan 생성
- `POST /api/onboarding/swarm` behavior swarm 후보 생성
- `POST /api/plans` 새 plan version 생성
- `POST /api/daily-actions` 오늘 행동 할당
- `POST /api/daily-actions/[dailyActionId]/complete` 완료 처리
- `POST /api/daily-actions/[dailyActionId]/failure` 실패 처리
- `GET /api/weekly-reviews` 주간/월간 리뷰 조회
- `PUT /api/weekly-reviews` 리뷰 저장
- `GET /api/locale` locale 쿠키 설정

## 핵심 데이터 모델

- 한 사용자 = 여러 goal
- 한 goal = 여러 plan version
- 한 plan = 최대 3개 micro-action
- 한 goal / 날짜 = daily action 1개
- fallback action은 필수
- goal anchor는 `primary`, `backup` 역할로 구분

## AI 규칙

- JSON만 반환
- 1~5분 안에 가능한 행동 우선
- vague 문구 금지
- 관찰 가능한 행동 우선
- fallback action 필수
- 실패 시 더 작은 행동 또는 더 좋은 anchor로 조정

## 테스트

```bash
npm test
```

타입 검사:

```bash
npx tsc --noEmit
```

## UI 원칙

- 웹 문구는 한국어 우선
- 설명은 짧게
- 카드/리스트/단일 선택 위주
- Today와 Recovery는 부담을 낮추는 방향 유지
- 모바일에서도 한 화면이 복잡해지지 않도록 계속 다듬을 예정

## 참고 파일

- [components/onboarding/onboarding-form.tsx](components/onboarding/onboarding-form.tsx)
- [components/onboarding/plan-review-form.tsx](components/onboarding/plan-review-form.tsx)
- [components/today/action-card.tsx](components/today/action-card.tsx)
- [components/today/recovery-flow.tsx](components/today/recovery-flow.tsx)
- [lib/ai/index.ts](lib/ai/index.ts)
- [lib/validators/habit.ts](lib/validators/habit.ts)
- [lib/validators/backend.ts](lib/validators/backend.ts)
- [lib/supabase/habit-service.ts](lib/supabase/habit-service.ts)
- [supabase/schema.sql](supabase/schema.sql)
- [supabase/migrations/20260328140000_habit_v1_wizard.sql](supabase/migrations/20260328140000_habit_v1_wizard.sql)

---

## Codex 개발 워크플로

이 저장소는 제품 안에 멀티 에이전트 기능을 넣는 것이 아니라,  
**Codex의 planner / builder / reviewer 구조로 Habit 웹을 더 안정적으로 개발하기 위한 저장소 운영 레이어**를 함께 사용합니다.

### 추가 파일

아래 파일을 저장소 루트에 추가합니다.

```text
AGENTS.md
.codex/config.toml
.codex/agents/planner.toml
.codex/agents/builder.toml
.codex/agents/reviewer.toml
.agents/skills/product-prd/SKILL.md
.agents/skills/prompt-contract/SKILL.md
.agents/skills/eval-gate/SKILL.md
```

### 각 파일 역할

- `AGENTS.md`
  - 저장소 전체 공통 규칙
  - 현재 Habit 제품의 가드레일
  - Planner / Builder / Reviewer handoff 형식
- `.codex/agents/planner.toml`
  - 새 기능을 작은 MVP 기획으로 정리
- `.codex/agents/builder.toml`
  - 승인된 범위만 최소 diff로 구현
- `.codex/agents/reviewer.toml`
  - acceptance criteria와 회귀 위험 기준으로 검토
- `.agents/skills/product-prd/SKILL.md`
  - 기능 기획 정리
- `.agents/skills/prompt-contract/SKILL.md`
  - AI 구조 변경 시 입력/출력 계약, fallback, retry, timeout 정리
- `.agents/skills/eval-gate/SKILL.md`
  - 구현 후 pass / conditional pass / fail 검토

### 권장 기본 설정

`.codex/config.toml`

```toml
[agents]
max_threads = 3
max_depth = 1
```

### 개발 루프

1. planner로 기능 범위와 acceptance criteria를 먼저 정리
2. builder로 승인된 범위만 구현
3. reviewer로 회귀 위험과 요구사항 충족 여부 검토
4. 필요한 경우 builder가 최소 수정
5. reviewer가 최종 verdict 정리

### 한국어 호출 예시

#### 1. 기획

```text
planner를 사용해서 Habit 저장소 기준으로 이 기능을 작은 MVP로 기획해 주세요.

먼저 아래 파일을 읽고 시작하세요.
- README.md
- app/onboarding/page.tsx
- lib/ai/index.ts
- lib/supabase/habit-service.ts

product-prd skill을 사용하고,
반드시 아래 순서로 정리하세요.
- 문제
- 사용자 가치
- 현재 Habit 흐름에서 붙는 위치
- MVP 범위
- 비범위
- 영향 파일
- acceptance criteria
- 리스크
- Builder handoff notes

기능:
[여기에 기능 설명]
```

#### 2. 구현

```text
builder를 사용해서 Habit 저장소에 구현해 주세요.

조건:
- planner가 정의한 범위만 구현
- diff는 최소화
- AI 출력 구조를 건드리면 prompt-contract skill을 먼저 사용
- 끝나면 변경 파일, 구현 요약, 검증 방법, known limitations를 한국어로 정리

기획 문서:
[여기에 planner 결과 붙여넣기]
```

#### 3. 검토

```text
reviewer를 사용해서 Habit 저장소 변경 사항을 검토해 주세요.

조건:
- eval-gate skill 사용
- acceptance criteria 기준으로만 평가
- onboarding / today / recovery / AI 계약 / 서비스 흐름 회귀를 우선 확인
- verdict, 요구사항 충족 여부, 결함, UX 이슈, 위험 평가, 우선 수정 항목, 출시 권고를 한국어로 정리

기획 문서:
[planner 결과]

구현 요약:
[builder 결과]
```

### 이 워크플로를 쓸 때 주의할 점

- 제품 기능 추가와 버그 수정 범위를 섞지 않습니다.
- `lib/ai/index.ts`를 건드릴 때는 schema validation, fallback, retry, timeout을 반드시 확인합니다.
- `lib/supabase/habit-service.ts`를 건드릴 때는 goal -> plan -> daily action 흐름이 깨지지 않는지 확인합니다.
- 모바일에서 한 화면이 무거워지지 않도록 유지합니다.
- Habit을 일반적인 habit tracker 방향으로 넓히지 않습니다.
