-- ============================================================
-- get_emp_by_phone RPC 업데이트
-- account_email, system_role 컬럼 추가 반환
-- Supabase Dashboard → SQL Editor에서 실행
-- ============================================================

CREATE OR REPLACE FUNCTION get_emp_by_phone(p_phone TEXT)
RETURNS TABLE (
  emp_no        TEXT,
  emp_name      TEXT,
  emp_uuid      UUID,
  site_code     TEXT,
  work_code     TEXT,
  pin4          TEXT,
  account_email TEXT,
  system_role   TEXT
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    e.emp_no,
    e.name                                        AS emp_name,
    e.id                                          AS emp_uuid,
    COALESCE(e.site_code_1, e.site_code, 'V000') AS site_code,
    e.work_code,
    RIGHT(REGEXP_REPLACE(e.phone, '\D', '', 'g'), 4) AS pin4,
    COALESCE(e.account_email, '')                 AS account_email,
    COALESCE(e.system_role, 'field_member')       AS system_role
  FROM employees e
  WHERE REGEXP_REPLACE(e.phone, '\D', '', 'g') = REGEXP_REPLACE(p_phone, '\D', '', 'g')
    AND e.is_active = true
  LIMIT 1;
$$;

-- anon 실행 권한 유지
GRANT EXECUTE ON FUNCTION get_emp_by_phone(TEXT) TO anon, authenticated;
