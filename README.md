# Habit Backend MVP

이 프로젝트는 시작이 어려운 사용자를 위한 마이크로 습관 코치입니다. 이번 작업에서는 Supabase 기반의 MVP 백엔드 데이터 레이어를 추가했습니다.

## 포함된 항목

- `supabase/schema.sql`
- `supabase/seed.sql`
- `lib/types/database.ts`
- `lib/schemas/backend.ts`
- `app/api/onboarding/route.ts`
- `app/api/plans/route.ts`
- `app/api/daily-actions/route.ts`
- `app/api/daily-actions/[dailyActionId]/complete/route.ts`
- `app/api/daily-actions/[dailyActionId]/failure/route.ts`
- `app/api/weekly-reviews/route.ts`

## 데이터 모델 요약

- `users`: 앱 사용자 프로필
- `goals`: 사용자의 목표
- `anchors`: 습관을 시작할 단서
- `habit_plans`: 목표별 계획 버전
- `micro_actions`: 1~5분 액션과 필수 fallback
- `daily_actions`: 오늘의 액션
- `action_logs`: 할당, 완료, 실패 로그
- `weekly_reviews`: 주간 회고
- `subscriptions`: 구독 상태
- `notifications`: 알림 큐

핵심 제약도 반영했습니다.

- 목표별 하루 행동은 `unique (goal_id, action_date)`로 1개만 허용
- 계획 버전은 `habit_plans.version`으로 관리
- fallback 액션은 `micro_actions.fallback_*` 필드로 필수화
- 실패 사유는 `failure_reason` enum으로 제한
- 각 계획의 마이크로 액션은 최대 3개

## 로컬 설정

1. `.env.example`를 `.env.local`로 복사합니다.
2. Supabase 프로젝트 URL, anon key, service role key를 채웁니다.
3. Supabase SQL Editor 또는 로컬 Postgres에서 `supabase/schema.sql`을 먼저 실행합니다.
4. 이어서 `supabase/seed.sql`을 실행합니다.
5. 앱을 실행합니다.

```bash
npm run dev
```

테스트 실행:

```bash
npm test
```

## API 요약

### `POST /api/onboarding`

온보딩 입력을 받아 `anchor`, `goal`, 첫 번째 `habit_plan`을 생성합니다. `microActions`를 생략하면 현재는 플레이스홀더 AI 서비스가 기본 액션을 생성합니다.

예시:

```json
{
  "userId": "11111111-1111-1111-1111-111111111111",
  "goalTitle": "Build a reading habit",
  "goalWhy": "I want reading to feel normal again.",
  "difficulty": "gentle",
  "availableMinutes": 5,
  "anchorLabel": "After coffee",
  "anchorCue": "When the mug is on the desk",
  "preferredTime": "morning"
}
```

### `POST /api/plans`

새 계획 버전을 생성합니다. 기존 active 플랜은 자동으로 archived 처리됩니다.

### `POST /api/daily-actions`

오늘의 액션을 생성하거나 같은 날짜의 액션을 교체합니다.

### `POST /api/daily-actions/:dailyActionId/complete`

오늘의 액션을 완료 처리하고 로그를 남깁니다.

### `POST /api/daily-actions/:dailyActionId/failure`

실패 사유를 enum으로 저장하고, 필요하면 더 작은 recovery plan 버전을 자동 생성합니다.

### `GET /api/weekly-reviews`

쿼리 파라미터 `userId`, `goalId`, `weekStart`로 회고를 조회합니다.

### `PUT /api/weekly-reviews`

주간 회고를 upsert 합니다.

## 참고 사항

- 현재 API는 서버에서 `SUPABASE_SERVICE_ROLE_KEY`를 사용합니다.
- 따라서 실제 배포 전에는 인증된 세션의 사용자와 `userId`를 연결하는 인증 계층을 붙이는 것이 좋습니다.
- 기존 페이지는 아직 mock 데이터를 사용하므로, 프론트엔드 연결 작업은 별도로 남아 있습니다.
