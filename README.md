# 치킨 증바람

증강 칼바람 내전의 대전 일정, 결과, 선수 티어를 기록하는 반응형 웹사이트입니다. Vercel에서 실행되는 Next.js 앱이며, 회원가입·DB·선수 썸네일은 Supabase를 사용합니다.

[서비스 바로가기](https://chicken-aram.vercel.app)

## 핵심 기능

- Supabase Authentication·RLS·Storage 기반 회원 및 역할별 권한 관리
- 일정 생성 트랜잭션, 요청 속도 제한, 관리자 변경 감사 로그
- Next.js 16·React 19 기반 반응형 UI와 단위·통합·Playwright E2E 검증

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
2. Supabase CLI로 프로젝트를 연결하고 `npx supabase db push`를 실행해 `supabase/migrations` 전체를 순서대로 적용합니다.
3. Authentication → Sign In / Providers에서 `Confirm email`을 켭니다.
4. 회원가입을 완료한 관리자 계정 하나를 아래 SQL로 승격합니다.

```sql
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'admin@example.com');
```

마이그레이션은 RLS 정책과 `player-thumbnails` Storage 버킷을 생성합니다.

## Vercel 배포

GitHub 저장소를 Vercel에 Import한 다음 Framework Preset은 `Next.js`를 사용합니다. Build Command와 Output Directory는 기본값을 유지하고, 프로젝트의 Environment Variables에 `.env.example`의 서비스 환경변수를 등록합니다.

## 검증

```bash
npm run build
npm run lint
npm run test:unit
```

원격 통합 테스트는 실제 데이터를 생성·삭제하므로 운영 프로젝트에서는 실행되지 않습니다. 별도 Supabase 테스트 프로젝트를 준비한 뒤 `SUPABASE_TEST_PROJECT_REF`와 `ALLOW_REMOTE_INTEGRATION_TESTS=true`를 명시한 환경에서만 `npm run test:integration`을 실행하세요.
