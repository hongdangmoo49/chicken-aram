# 치킨 증바람

증강 칼바람 내전의 대전 일정, 결과, 선수 티어를 기록하는 반응형 웹사이트입니다. Vercel에서 실행되는 Next.js 앱이며, 회원가입·DB·선수 썸네일은 Supabase를 사용합니다.

## 로컬 실행

```bash
npm install
Copy-Item .env.example .env.local
npm run dev
```

`.env.local`에 다음 값을 입력합니다.

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

`SUPABASE_SERVICE_ROLE_KEY`는 서버 전용 비밀키입니다. 이름 앞에 `NEXT_PUBLIC_`을 붙이거나 브라우저 코드에서 사용하면 안 됩니다.

## Supabase 준비

1. Supabase에서 새 프로젝트를 만듭니다.
2. SQL Editor에서 [`supabase/migrations/202607200001_initial_schema.sql`](supabase/migrations/202607200001_initial_schema.sql)을 실행합니다.
3. Authentication → Sign In / Providers에서 `Confirm email`을 끕니다.
4. 회원가입을 완료한 관리자 계정 하나를 아래 SQL로 승격합니다.

```sql
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'admin@example.com');
```

마이그레이션은 RLS 정책과 `player-thumbnails` Storage 버킷을 생성합니다.

## Vercel 배포

GitHub 저장소를 Vercel에 Import한 다음 Framework Preset은 `Next.js`를 사용합니다. Build Command와 Output Directory는 기본값을 유지하고, 프로젝트의 Environment Variables에 `.env.example`의 세 값을 등록합니다.

## 검증

```bash
npm run build
npm run lint
node --experimental-strip-types --test tests/*.test.mjs
```
