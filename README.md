# Habit

시작이 어려운 사용자를 위한 마이크로 습관 코치 프로젝트입니다.

## 폴더 구조

```text
app/
  page.tsx
  login/page.tsx
  signup/page.tsx
  onboarding/page.tsx
  today/page.tsx
  recover/page.tsx
  review/page.tsx

components/
  ui/
  onboarding/
  today/
  review/

lib/
  ai/
  supabase/
  validators/
  utils/

types/
  index.ts

supabase/
  migrations/
  schema.sql
  seed.sql
```

## Supabase 운영 방식

이제부터는 `supabase/migrations`를 기준으로 DB 변경을 관리합니다.

- `supabase/migrations/20260327190000_initial_schema.sql`
  초기 스키마 마이그레이션 파일입니다.
- `supabase/schema.sql`
  현재 스키마를 한 번에 보기 쉬운 스냅샷 파일입니다.
- `supabase/seed.sql`
  로컬 개발과 데모 확인용 시드 데이터입니다.

권장 원칙:

- DB 변경은 Supabase 대시보드에서 직접만 수정하지 말고, 먼저 migration 파일로 남깁니다.
- PR마다 migration이 같이 올라가도록 Git에 커밋합니다.
- 운영 반영 전에는 preview branch 또는 staging에서 먼저 확인합니다.

## GitHub 연동 기준 업데이트 흐름

1. 스키마를 바꿔야 하면 `supabase/migrations` 아래에 새 SQL 파일을 추가합니다.
2. 필요한 경우 `supabase/seed.sql`도 같이 갱신합니다.
3. 코드와 migration을 함께 커밋합니다.
4. GitHub PR을 열어 review 합니다.
5. Supabase GitHub Integration 또는 Branching 환경에서 preview DB에 반영되는지 확인합니다.
6. `main`에 머지한 뒤 production 반영을 확인합니다.

예시 파일 이름:

```text
supabase/migrations/20260328103000_add_reminder_preferences.sql
supabase/migrations/20260329120000_update_weekly_review_indexes.sql
```

## 로컬 설정

1. `.env.example`를 `.env.local`로 복사합니다.
2. 아래 값을 채웁니다.

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5
```

3. Supabase SQL Editor에서 아래 순서로 실행합니다.

- `supabase/migrations/20260327190000_initial_schema.sql`
- `supabase/seed.sql`

4. 개발 서버를 실행합니다.

```bash
npm run dev
```

## 확인 포인트

- `today`, `recover`, `review` 화면은 Supabase가 연결되어 있으면 seed 데이터를 우선 읽습니다.
- 환경 변수가 없거나 조회가 실패하면 mock 데이터로 안전하게 fallback 합니다.
- OpenAI 없이도 Supabase 연결 확인은 가능합니다.

## 테스트

```bash
npm test
npx tsc --noEmit
```
