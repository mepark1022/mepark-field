-- ============================================================
-- 미팍ERP 현장앱 파트2 마이그레이션
-- Supabase SQL Editor에서 실행
-- ============================================================

-- 1. daily_reports에 staff_count 컬럼 추가 (현장앱에서 간편 입력용)
ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS staff_count INTEGER DEFAULT 0;

-- 2. daily_reports에 reporter_id가 employees를 참조하도록 확인
-- (이미 존재하면 무시됨)
-- reporter_id는 현장앱 로그인 직원의 employees.id를 저장

-- 완료 확인
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'daily_reports'
ORDER BY ordinal_position;
