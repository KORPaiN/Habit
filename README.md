# Habit

시작이 어려운 사람을 위한 실행 중심 마이크로 습관 코치입니다.

이 앱은 일반적인 습관 기록장이 아닙니다. 큰 목표를 오늘 바로 할 수 있는 1~5분짜리 아주 작은 행동으로 바꾸고, 그것마저 어렵다면 사용자를 압박하는 대신 행동 크기를 다시 줄여주는 데 초점을 둡니다.

## 현재 MVP 상태

현재 구현된 범위:

- 랜딩 페이지
- Supabase Auth 기반 Google 전용 로그인/회원가입 흐름
- 목표, 난이도, 가능 시간, 선호 시간대, 앵커를 받는 온보딩
- JSON 전용 출력 규칙을 따르는 AI 마이크로 액션 생성
- 오늘의 행동 1개와 fallback 행동을 보여주는 Today 화면
- 행동이 부담스러울 때 더 작게 줄이는 복구 흐름
- 주간 패턴을 요약하는 Weekly Review 화면
- Supabase 스키마, 마이그레이션, RPC 기반 서비스 레이어, 기본 시드 데이터
- API 요청 payload에 대한 Zod 검증
- 순수 유틸 함수와 검증 로직에 대한 기본 테스트

아직 남아 있는 부분:

- `.env.example` 파일은 아직 없습니다
- 주간 리뷰 문구는 아직 AI 생성이 아니라 서비스 레이어의 규칙 기반 생성입니다
- Supabase 또는 OpenAI를 사용할 수 없을 때 일부 화면은 mock/demo 데이터로 fallback 됩니다

## 제품 핵심 루프

1. 사용자가 목표를 입력합니다.
2. 시스템이 목표를 아주 작은 마이크로 액션으로 쪼갭니다.
3. 사용자는 오늘 할 행동 하나를 받거나 선택합니다.
4. 실패하면 의지 문제로 보지 않고 행동을 더 작게 줄입니다.
5. 주간 리뷰에서 무엇이 도움이 됐고 무엇이 어려웠는지 확인합니다.

## 기술 스택

- Next.js 15 App Router
- TypeScript
- Tailwind CSS v4
- Supabase
- Zod
- OpenAI Responses API

## 주요 화면 경로

- `/` 랜딩 페이지
- `/login` Google 로그인
- `/signup` Google 회원가입 진입
- `/onboarding` 온보딩 폼 및 실시간 계획 미리보기
- `/today` 오늘의 행동 화면
- `/recover` 실패 복구 흐름
- `/review` 주간 리뷰 화면

## API 구성

현재 포함된 Route Handler:

- `POST /api/onboarding`
- `POST /api/plans`
- `POST /api/daily-actions`
- `POST /api/daily-actions/:dailyActionId/complete`
- `POST /api/daily-actions/:dailyActionId/failure`
- `GET /api/weekly-reviews`
- `PUT /api/weekly-reviews`
- `GET /api/locale`

모든 요청 payload는 서비스 레이어로 들어가기 전에 Zod로 검증합니다.

## 프로젝트 구조

```text
app/
  api/
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
```

## 로컬 실행 방법

1. 의존성을 설치합니다.

```bash
npm install
```

2. `C:\Habit\.env.local` 파일을 만들고 아래 값을 채웁니다.

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5
```

3. Supabase SQL Editor에서 데이터베이스 스키마를 적용합니다.

- `supabase/migrations/20260327190000_initial_schema.sql`
- `supabase/seed.sql`

4. 개발 서버를 실행합니다.

```bash
npm run dev
```

5. [http://localhost:3000](http://localhost:3000)에서 확인합니다.

## AI 동작 원칙

AI 분해 로직은 아래 규칙을 따르도록 설계되어 있습니다.

- JSON만 반환할 것
- 1~5분 안에 끝나는 행동을 만들 것
- 모호한 표현을 피할 것
- 관찰 가능한 행동을 우선할 것
- fallback 행동을 반드시 포함할 것
- 실패 이유가 `too_big`이면 행동을 더 작게 줄일 것

OpenAI 요청이 실패하거나 API 키가 없으면, UI가 계속 동작할 수 있도록 결정적인 mock decomposition으로 fallback 됩니다.

## Supabase 운영 메모

데이터베이스 변경은 `supabase/migrations` 기준으로 관리합니다.

- `supabase/migrations/20260327190000_initial_schema.sql`: 초기 스키마
- `supabase/migrations/20260328103000_add_notification_preferences_example.sql`: 후속 마이그레이션 예시
- `supabase/schema.sql`: 전체 스키마 스냅샷
- `supabase/seed.sql`: 로컬/데모 확인용 시드 데이터

현재 서비스 레이어는 아래 작업을 Supabase RPC 함수에 의존합니다.

- 온보딩 목표 생성
- 플랜 버전 생성
- 일일 행동 배정
- 일일 행동 완료 처리
- 실패 보고 처리
- 주간 리뷰 upsert

또한 `middleware.ts`에서 앱 요청 시 Supabase 인증 상태를 갱신합니다.

## 테스트

실행 명령:

```bash
npm test
npx tsc --noEmit
```

현재 테스트 범위:

- habit 유틸 함수 동작
- AI 프롬프트 및 decomposition 제약
- 백엔드 검증 로직과 플랜 매핑 유틸

## 동작 메모

- `today`, `recover`, `review` 화면은 Supabase가 연결되어 있으면 저장된 데이터를 기준으로 렌더링됩니다.
- 라이브 데이터가 없거나 외부 서비스 호출에 실패하면 일부 흐름은 mock/demo 데이터로 fallback 됩니다.
- 인증 방식은 현재 Google 전용입니다.
