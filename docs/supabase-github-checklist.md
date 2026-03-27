# Supabase GitHub 연동 체크리스트

## 1. 저장소 준비

- `supabase/migrations` 폴더가 Git에 커밋되어 있는지 확인
- `supabase/seed.sql`이 최신 로컬/데모 상태와 맞는지 확인
- 민감한 키가 Git에 올라가지 않았는지 확인

## 2. Supabase 대시보드 준비

- 대상 프로젝트 선택
- `Branching` 또는 `Integrations` 메뉴 진입
- GitHub 저장소 연결

## 3. 권장 운영 방식

- DB 변경은 대시보드에서 직접 수정만 하지 않기
- 먼저 `supabase/migrations/<timestamp>_<name>.sql` 생성
- 코드 변경과 migration을 같은 PR에 포함
- preview branch에서 먼저 확인 후 `main` 머지

## 4. PR 체크 항목

- migration 파일 이름이 타임스탬프 형식인지 확인
- 되돌리기 어려운 파괴적 변경인지 확인
- seed 변경이 필요한지 확인
- 앱 코드가 새 스키마를 참조하도록 업데이트됐는지 확인

## 5. 머지 후 확인

- Supabase 프로젝트에 새 컬럼/테이블이 생성됐는지 확인
- 앱 주요 화면에서 실제 데이터 조회 확인
- 서버 로그와 SQL 실행 에러 확인

## 예시 명령/파일 패턴

```text
supabase/migrations/20260328103000_add_reminder_preferences.sql
supabase/migrations/20260329120000_update_daily_action_indexes.sql
```
