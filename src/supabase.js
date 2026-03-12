import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("Supabase 환경변수가 설정되지 않았습니다. .env 파일을 확인하세요.");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    storage: localStorage,
  },
});

// ─── Edge Function 헬퍼 ────────────────────────────────────────────────
export async function callAdminApi(payload) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token || SUPABASE_ANON_KEY;

  const res = await fetch(
    `${SUPABASE_URL}/functions/v1/admin-api`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ─── 현장 PIN 로그인 ────────────────────────────────────────────────────
// employees 테이블에서 emp_id 조회 → field_pin 비교 → 해당 auth 세션 반환
export async function fieldLogin(empId, pin) {
  // 1. employees에서 emp_id로 직원 조회 (anon key로 접근 가능한 필드만)
  const { data: emp, error: empErr } = await supabase
    .from("employees")
    .select("id, name, emp_id, site_code, work_type, field_pin, auth_user_id")
    .eq("emp_id", empId.trim().toUpperCase())
    .eq("status", "active")
    .single();

  if (empErr || !emp) {
    throw new Error("사번을 찾을 수 없습니다. 관리자에게 문의하세요.");
  }

  // 2. PIN 검증 (field_pin 컬럼에 4자리 숫자 저장)
  if (!emp.field_pin) {
    throw new Error("PIN이 설정되지 않았습니다. 관리자에게 문의하세요.");
  }
  if (emp.field_pin !== pin) {
    throw new Error("PIN이 올바르지 않습니다.");
  }

  // 3. 해당 직원의 auth 계정으로 로그인 (Edge Function 경유)
  //    Edge Function이 service_role로 signInWithPassword 대신 createSession 처리
  const result = await callAdminApi({
    action: "field_login",
    emp_id: empId.trim().toUpperCase(),
    pin,
  });

  if (!result.access_token) {
    throw new Error("로그인 처리에 실패했습니다.");
  }

  // 4. 세션 설정
  const { data: sessionData, error: sessionErr } = await supabase.auth.setSession({
    access_token: result.access_token,
    refresh_token: result.refresh_token,
  });

  if (sessionErr) throw sessionErr;

  return {
    session: sessionData.session,
    employee: emp,
  };
}
