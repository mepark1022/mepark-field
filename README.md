# ME.PARK 현장 크루 마감보고 앱

> ME.PARK ERP v8.3 — 현장 크루 전용 모바일 앱

## 개요

현장 크루(field_leader / field_staff)가 모바일로 일일 마감보고를 입력하는 경량 앱.
동일한 Supabase 백엔드를 공유하며, 입력 데이터는 ERP 관리자 화면에 자동 반영됩니다.

- **배포**: `mepark-field.vercel.app`
- **ERP**: `mepark-contract.vercel.app`
- **Supabase**: `rtmdvzavbatzjqaoltfd.supabase.co`

## 로그인 방식

사번 + 4자리 PIN 로그인 (Supabase Auth 경유)

## 설치 및 실행

```bash
npm install
cp .env.example .env  # 환경변수 설정
npm run dev
```

## 환경변수 (.env)

```
VITE_SUPABASE_URL=https://rtmdvzavbatzjqaoltfd.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

## Supabase 설정

### 1. employees 테이블 확장
`field-login-setup.sql` 실행 (Dashboard → SQL Editor)

### 2. Edge Function 업데이트
`edge-function-field-login.js` 참고하여 admin-api에 `field_login` case 추가

## 개발 파트

- **파트 1**: 프로젝트 초기화 + 로그인 화면 ✅
- **파트 2**: 메인 화면 + 일보 입력 폼
- **파트 3**: 제출 로직 + 관리자 연동 확인

## 기술 스택

- React 18 + Vite 5
- @supabase/supabase-js
- 인라인 스타일 (Tailwind 미사용)
- 모바일 최적화
