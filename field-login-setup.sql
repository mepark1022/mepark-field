-- ═══════════════════════════════════════════════════════════════
-- mepark-field 현장앱 로그인 설정 SQL
-- Supabase Dashboard → SQL Editor에서 실행
-- ═══════════════════════════════════════════════════════════════

-- 1. employees 테이블에 현장앱 로그인 관련 컬럼 추가
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS field_pin      TEXT,           -- 4자리 PIN (평문 저장, 추후 해시 가능)
  ADD COLUMN IF NOT EXISTS auth_user_id   UUID REFERENCES auth.users(id),  -- Supabase Auth 연동
  ADD COLUMN IF NOT EXISTS field_role     TEXT DEFAULT 'field_staff';       -- field_leader / field_staff

-- 2. auth_user_id 인덱스
CREATE INDEX IF NOT EXISTS idx_employees_auth_user_id ON employees(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_employees_field_role ON employees(field_role);

-- 3. RLS 정책: anon 사용자도 사번으로 직원 존재 여부 확인 가능 (field_pin 제외)
-- 기존 RLS가 있다면 아래 정책 추가
CREATE POLICY IF NOT EXISTS "Field login: anon can check emp_id"
  ON employees FOR SELECT
  TO anon
  USING (true);  -- 필요시 특정 컬럼만 노출하도록 제한

-- 주의: 위 정책이 너무 넓으면 아래처럼 뷰로 제한 가능
-- CREATE VIEW employees_public AS
--   SELECT id, name, emp_id, status, site_code, work_type
--   FROM employees;

-- 4. 현장 크루 Supabase Auth 계정 생성 후 매핑 방법:
-- (관리자가 ERP에서 직원별 PIN 설정 시 자동으로 처리할 예정)
-- 수동으로 하려면:
-- UPDATE employees SET field_pin = '1234' WHERE emp_id = 'MP24110';
-- UPDATE employees SET auth_user_id = 'auth-uuid-here' WHERE emp_id = 'MP24110';
