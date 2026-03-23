-- ========================================
-- 추가근무 시간 입력 컬럼 추가
-- daily_report_staff 테이블에 check_in / check_out 컬럼 추가
-- 실행: Supabase Dashboard → SQL Editor
-- ========================================

-- 출근시간 (HH:MM 형식, 예: "09:00")
ALTER TABLE daily_report_staff ADD COLUMN IF NOT EXISTS check_in TEXT;

-- 퇴근시간 (HH:MM 형식, 예: "18:00")
ALTER TABLE daily_report_staff ADD COLUMN IF NOT EXISTS check_out TEXT;
