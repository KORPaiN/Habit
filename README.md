# Habit

시작이 어려운 사람을 위한 실행 중심 마이크로 습관 코치입니다.

Habit은 일반적인 습관 기록 앱이 아닙니다. 큰 목표를 오늘 바로 할 수 있는 1~5분짜리 작은 행동으로 바꾸고, 실패했을 때는 의지 부족으로 몰아가지 않고 행동 크기를 더 줄여 다시 시작할 수 있게 돕는 서비스입니다.

## 현재 구현 범위

현재 프로젝트에 구현되어 있는 기능:

- 랜딩 페이지
- Google 전용 로그인/회원가입 흐름
- 온보딩
  - 목표 입력
  - 체감 난이도 입력
  - 사용 가능 시간 입력
  - 선호 시간대 선택
  - 앵커(anchor) 선택 또는 저장된 앵커 재사용
- AI 기반 마이크로 액션 계획 생성
- 오늘의 행동 화면
- 실패 복구 흐름
- 월별 리뷰 화면
- 앵커 저장/삭제 화면
- Supabase 기반 사용자/목표/플랜/리뷰 데이터 처리
- API payload Zod 검증
- 기본 보안 유틸
  - same-origin 검사
  - rate limit
  - idempotency
  - 보안 헤더

아직 문서상 명확히 구분해둘 점:

- README에서 설명하는 기능 중 일부는 mock/demo 데이터 fallback을 사용합니다.
- 리뷰 문구 생성은 현재 파일 기준으로 AI 요약보다 규칙 기반 상태 조합이 포함되어 있습니다.
- `.env.example` 파일은 아직 없습니다.

## 핵심 제품 루프

1. 사용자가 목표를 입력합니다.
2. 시스템이 목표를 아주 작은 행동들로 나눕니다.
3. 오늘 할 행동 하나에 집중합니다.
4. 행동이 너무 크면 더 작게 줄입니다.
5. 리뷰에서 패턴을 보고 다음 조정을 정합니다.

## 기술 스택

- Next.js 15 App Router
- TypeScript
- React 19
- Tailwind CSS v4
- Supabase
- Zod
- OpenAI Responses API

## 주요 경로

- `/` 랜딩 페이지
- `/login` 로그인
- `/signup` 회원가입 및 언어 확정
- `/onboarding` 온보딩
- `/onboarding/help` 온보딩 도움말
- `/today` 오늘의 행동
- `/recover` 실패 복구
- `/review` 월별 리뷰
- `/anchors` 저장된 앵커 관리
- `/auth/callback` Google OAuth 콜백

## API 엔드포인트

현재 포함된 Route Handler:

- `GET /api/locale`
- `POST /api/onboarding`
- `POST /api/plans`
- `POST /api/daily-actions`
- `POST /api/daily-actions/:dailyActionId/complete`
- `POST /api/daily-actions/:dailyActionId/failure`
- `GET /api/weekly-reviews`
- `PUT /api/weekly-reviews`

모든 주요 요청 payload는 `lib/validators` 아래 Zod 스키마로 검증합니다.

## 폴더 구조

```text
app/
  api/
  anchors/
  auth/
  login/
  onboarding/
  recover/
  review/
  signup/
  today/

components/
  auth/
  onboarding/
  review/
  today/
  ui/

lib/
  ai/
  security/
  supabase/
  utils/
  validators/

supabase/
  migrations/
  schema.sql
  seed.sql

tests/
  ai.test.ts
  backend.test.ts
  habit.test.ts
  security.test.ts
```

## 주요 파일 설명

- `app/onboarding/page.tsx`
  온보딩 메인 화면입니다.
- `components/onboarding/onboarding-form.tsx`
  실제 온보딩 입력 폼입니다.
- `app/today/page.tsx`
  오늘의 행동과 fallback 행동을 보여줍니다.
- `components/today/recovery-flow.tsx`
  실패 시 행동을 더 작게 줄이는 흐름을 담당합니다.
- `app/review/page.tsx`
  월 선택과 달력형 리뷰를 보여줍니다.
- `app/anchors/page.tsx`
  저장된 앵커를 관리합니다.
- `lib/ai/index.ts`
  AI 계획 생성 및 fallback decomposition 로직이 들어 있습니다.
- `lib/supabase/habit-service.ts`
  Supabase RPC와 데이터 접근 로직의 중심입니다.
- `lib/security/route-guard.ts`
  인증, same-origin, rate limit 관련 보호 로직이 들어 있습니다.

## 로컬 실행 방법

1. 의존성을 설치합니다.

```bash
npm install
```

2. 프로젝트 루트에 `.env.local` 파일을 만들고 값을 채웁니다.

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5
```

3. Supabase에 스키마와 시드 데이터를 적용합니다.

먼저 실행:

- `supabase/migrations/20260327190000_initial_schema.sql`
- `supabase/migrations/20260327235900_default_locale_ko.sql`
- `supabase/migrations/20260328103000_add_notification_preferences_example.sql`
- `supabase/migrations/20260328113000_add_user_locale.sql`
- `supabase/migrations/20260328123000_reuse_existing_anchors.sql`

필요하면 추가로:

- `supabase/seed.sql`

4. 개발 서버를 실행합니다.

```bash
npm run dev
```

포트를 지정해서 실행하려면:

```bash
npm run dev -- -p 3002
```

5. 브라우저에서 앱을 확인합니다.

- 기본: `http://localhost:3000`
- 예시: `http://localhost:3002`

## AI 동작 원칙

현재 코드 기준 AI 계획 생성 로직은 아래 원칙을 따릅니다.

- JSON만 반환하도록 유도
- 1~5분 내 행동 생성
- 모호한 표현 방지
- 관찰 가능한 행동 우선
- fallback 행동 필수
- 실패 이유가 `too_big`일 때 더 작은 행동으로 재설계

OpenAI 호출이 실패하거나 설정이 없으면 `lib/ai/index.ts`에서 mock decomposition으로 fallback 합니다.

## 인증과 사용자 흐름

- 인증은 Google OAuth 중심입니다.
- 회원가입 시 언어를 먼저 확정하는 흐름이 있습니다.
- Supabase Auth 사용자와 앱 사용자 정보를 동기화하는 로직이 포함되어 있습니다.
- 서버 전용 Supabase 클라이언트와 브라우저 전용 클라이언트가 분리되어 있습니다.

관련 파일:

- `lib/supabase/server-client.ts`
- `lib/supabase/browser-client.ts`
- `lib/supabase/auth.ts`
- `lib/supabase/app-user.ts`

## 보안 관련 구현

`lib/security` 아래에 기본 보안 유틸이 들어 있습니다.

- `headers.ts`
  CSP, `X-Frame-Options`, `X-Content-Type-Options` 등 보안 헤더
- `rate-limit.ts`
  메모리 기반 rate limit 유틸
- `idempotency.ts`
  중복 요청 재처리 방지
- `route-guard.ts`
  인증 사용자 확인, same-origin 검사, rate limit 적용
- `events.ts`
  보안 이벤트 로깅 유틸

관련 테스트는 `tests/security.test.ts`에 있습니다.

## Supabase 운영 메모

DB 변경은 `supabase/migrations` 기준으로 관리합니다.

현재 포함된 마이그레이션:

- `20260327190000_initial_schema.sql`
- `20260327235900_default_locale_ko.sql`
- `20260328103000_add_notification_preferences_example.sql`
- `20260328113000_add_user_locale.sql`
- `20260328123000_reuse_existing_anchors.sql`

참고 파일:

- `supabase/schema.sql`
- `supabase/seed.sql`
- `docs/supabase-github-checklist.md`

## 테스트

실행 명령:

```bash
npm test
npx tsc --noEmit
```

현재 테스트 범위:

- 습관 유틸 동작
- AI 프롬프트/행동 제약
- 백엔드 검증 로직
- 보안 유틸 동작

## 참고 사항

- 일부 화면은 Supabase 연결 상태나 세션 상태에 따라 demo/mock 데이터를 사용합니다.
- dev 서버에서 이전 캐시나 예전 로그 때문에 혼동될 수 있으므로, 오류 확인 시에는 새로 띄운 서버 기준으로 보는 것이 안전합니다.
- 현재 작업 트리는 이미 다른 수정 사항도 포함하고 있을 수 있으므로 README는 그 상태를 최대한 반영해 재구성했습니다.
