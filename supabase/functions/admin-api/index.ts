// ============================================================
// 미팍ERP — admin-api Edge Function v3 (컬럼명 수정 완료)
// emp_no, site_code_1, status='재직' 사용
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action } = body;

    if (action === "field_login") {
      const { emp_id, pin } = body;
      if (!emp_id || !pin) {
        return new Response(JSON.stringify({ error: "emp_id와 pin이 필요합니다." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const adminClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
        { auth: { autoRefreshToken: false, persistSession: false } }
      );

      // ★ emp_no 컬럼 사용 (NOT emp_id)
      const { data: emp, error: empErr } = await adminClient
        .from("employees")
        .select("id, name, emp_no, site_code_1, work_type, field_pin, auth_user_id, status, field_role")
        .eq("emp_no", emp_id.trim().toUpperCase())
        .single();

      if (empErr || !emp) {
        return new Response(JSON.stringify({ error: "등록되지 않은 사번입니다." }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // ★ status = '재직' (NOT 'active')
      if (emp.status !== "재직") {
        return new Response(JSON.stringify({ error: "재직 중인 직원이 아닙니다." }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!emp.field_pin) {
        return new Response(JSON.stringify({ error: "PIN이 설정되지 않았습니다. 관리자에게 문의하세요." }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (emp.field_pin !== pin) {
        return new Response(JSON.stringify({ error: "PIN이 올바르지 않습니다." }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const email = `${emp_id.trim().toLowerCase()}@field.mepark.internal`;
      const password = `MP_FIELD_${pin}_${emp.id.slice(0, 8)}`;
      let authUserId = emp.auth_user_id;

      if (!authUserId) {
        const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
          email, password, email_confirm: true,
          user_metadata: {
            // ★ emp_no, site_code_1 사용
            emp_id: emp.emp_no, name: emp.name,
            role: emp.field_role || "field_staff", site_code: emp.site_code_1,
          },
        });

        if (createErr && !createErr.message.includes("already been registered")) {
          return new Response(JSON.stringify({ error: "계정 생성 실패: " + createErr.message }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (createErr) {
          const { data: userList } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
          const existing = userList?.users?.find((u: any) => u.email === email);
          authUserId = existing?.id;
        } else {
          authUserId = newUser?.user?.id;
        }

        if (authUserId) {
          await adminClient.from("employees").update({ auth_user_id: authUserId }).eq("id", emp.id);
        }
      }

      if (!authUserId) {
        return new Response(JSON.stringify({ error: "Auth 계정을 찾을 수 없습니다." }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await adminClient.auth.admin.updateUserById(authUserId, { password });

      const { data: signInData, error: signInErr } = await adminClient.auth.signInWithPassword({ email, password });
      if (signInErr || !signInData?.session) {
        return new Response(JSON.stringify({ error: "세션 생성 실패: " + (signInErr?.message || "unknown") }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ★ emp_no → emp_id, site_code_1 → site_code로 매핑하여 응답
      return new Response(JSON.stringify({
        access_token: signInData.session.access_token,
        refresh_token: signInData.session.refresh_token,
        employee: {
          id: emp.id, name: emp.name, emp_id: emp.emp_no,
          site_code: emp.site_code_1, work_type: emp.work_type,
          field_role: emp.field_role || "field_staff",
        },
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ═══════ 이하 기존 관리자 액션 (변경 없음) ═══════

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "인증이 필요합니다." }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAnon = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: caller }, error: authError } = await supabaseAnon.auth.getUser();
    if (authError || !caller) {
      return new Response(JSON.stringify({ error: "인증 실패" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: callerProfile } = await supabaseAnon
      .from("profiles").select("role").eq("id", caller.id).single();

    if (!callerProfile || callerProfile.role !== "super_admin") {
      return new Response(JSON.stringify({ error: "슈퍼관리자만 실행 가능합니다." }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    if (action === "create_user") {
      const { email, password, name, role, site_code, employee_id, emp_no } = body;
      if (!email || !password || !name || !role) {
        return new Response(JSON.stringify({ error: "필수 정보가 누락되었습니다." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email, password, email_confirm: true, user_metadata: { name },
      });
      if (createError) {
        return new Response(JSON.stringify({ error: "계정 생성 실패: " + createError.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const userId = newUser?.user?.id;
      if (!userId) {
        return new Response(JSON.stringify({ error: "계정 생성 실패: ID를 받지 못했습니다." }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const profileData: any = { id: userId, email, name, role, created_at: new Date().toISOString() };
      if (site_code) profileData.site_code = site_code;
      if (employee_id) profileData.employee_id = employee_id;
      if (emp_no) profileData.emp_no = emp_no;
      const { error: profErr } = await supabaseAdmin.from("profiles").upsert(profileData, { onConflict: "id" });
      if (profErr) {
        return new Response(JSON.stringify({ error: "프로필 저장 실패: " + profErr.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: true, userId }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "ban_user") {
      const { userId } = body;
      if (!userId) return new Response(JSON.stringify({ error: "userId가 필요합니다." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: "876600h" });
      if (banError) return new Response(JSON.stringify({ error: "계정 차단 실패: " + banError.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      await supabaseAdmin.from("profiles").delete().eq("id", userId);
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "reset_password") {
      const { userId, newPassword } = body;
      if (!userId || !newPassword) return new Response(JSON.stringify({ error: "userId와 newPassword가 필요합니다." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const { error: resetError } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: newPassword });
      if (resetError) return new Response(JSON.stringify({ error: "비밀번호 리셋 실패: " + resetError.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "unban_user") {
      const { userId } = body;
      if (!userId) return new Response(JSON.stringify({ error: "userId가 필요합니다." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const { error: unbanError } = await supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: "none" });
      if (unbanError) return new Response(JSON.stringify({ error: "재활성화 실패: " + unbanError.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "bulk_create_field") {
      const { accounts } = body;
      if (!accounts || !Array.isArray(accounts) || accounts.length === 0) return new Response(JSON.stringify({ error: "생성할 계정 목록이 필요합니다." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (accounts.length > 50) return new Response(JSON.stringify({ error: "한 번에 최대 50개까지 생성 가능합니다." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const results = [];
      for (const acc of accounts) {
        const email = `${acc.emp_no.toLowerCase()}@field.mepark.app`;
        const password = acc.pin || "0000";
        try {
          const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name: acc.name } });
          if (createError) { results.push({ emp_no: acc.emp_no, success: false, error: createError.message }); continue; }
          const userId = newUser?.user?.id;
          await supabaseAdmin.from("profiles").upsert({ id: userId, email, name: acc.name, role: acc.role || "field_member", site_code: acc.site_code, employee_id: acc.employee_id, emp_no: acc.emp_no, created_at: new Date().toISOString() }, { onConflict: "id" });
          results.push({ emp_no: acc.emp_no, success: true, userId });
        } catch (e: any) { results.push({ emp_no: acc.emp_no, success: false, error: e.message }); }
      }
      const successCount = results.filter((r: any) => r.success).length;
      return new Response(JSON.stringify({ success: true, results, successCount, totalCount: accounts.length }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── phone_login: 전화번호 → emp_no 조회 → signInWithPassword ──
    // 같은 Supabase 프로젝트에 employees 테이블 존재 (ERP와 동일 프로젝트)
    if (action === "phone_login") {
      const { phone } = body;
      if (!phone) {
        return new Response(JSON.stringify({ error: "전화번호가 필요합니다." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const adminClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
        { auth: { autoRefreshToken: false, persistSession: false } }
      );

      // 숫자만 추출
      const digits = phone.replace(/\D/g, "");
      // 하이픈 포맷 변환 (010-XXXX-XXXX)
      const formatted = digits.length === 11
        ? `${digits.slice(0,3)}-${digits.slice(3,7)}-${digits.slice(7)}`
        : digits;

      // employees 테이블에서 전화번호로 직원 조회 (숫자형/하이픈형 둘 다 허용)
      const { data: emp, error: empErr } = await adminClient
        .from("employees")
        .select("id, name, emp_no, site_code_1, work_code, phone, status, auth_id")
        .in("phone", [digits, formatted])
        .eq("status", "재직")
        .limit(1)
        .maybeSingle();

      if (empErr) {
        console.error("employees 조회 오류:", empErr.message);
        return new Response(JSON.stringify({ error: "서버 오류: " + empErr.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!emp) {
        return new Response(JSON.stringify({ error: "등록되지 않은 전화번호입니다." }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // PIN = mp + 전화번호 뒤 4자리
      const empDigits = (emp.phone || "").replace(/\D/g, "");
      const pin4 = empDigits.slice(-4) || digits.slice(-4);
      if (!pin4 || pin4.length < 4) {
        return new Response(JSON.stringify({ error: "전화번호 정보가 올바르지 않습니다. 관리자에게 문의하세요." }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const password = `mp${pin4}`;
      const email = `${emp.emp_no.toLowerCase()}@mepark.internal`;

      // Supabase Auth 로그인 시도
      const { data: authData, error: authErr } = await adminClient.auth.signInWithPassword({ email, password });

      if (authErr || !authData?.session) {
        // auth 계정 없으면 → field.mepark.internal 시도 (field_member 계정)
        const fieldEmail = `${emp.emp_no.toLowerCase()}@field.mepark.internal`;
        const fieldPass = `MP_FIELD_${pin4}_${emp.id.slice(0, 8)}`;
        const { data: fieldAuth, error: fieldErr } = await adminClient.auth.signInWithPassword({
          email: fieldEmail, password: fieldPass,
        });
        if (fieldErr || !fieldAuth?.session) {
          // 계정 없으면 자동 생성
          const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
            email: fieldEmail, password: fieldPass, email_confirm: true,
            user_metadata: { emp_id: emp.emp_no, name: emp.name, role: "field_member", site_code: emp.site_code_1 },
          });
          if (createErr) {
            return new Response(JSON.stringify({ error: "계정 생성 실패: " + createErr.message }), {
              status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          const { data: retryAuth } = await adminClient.auth.signInWithPassword({ email: fieldEmail, password: fieldPass });
          if (!retryAuth?.session) {
            return new Response(JSON.stringify({ error: "로그인 처리 실패. 관리자에게 문의하세요." }), {
              status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          return new Response(JSON.stringify({
            access_token: retryAuth.session.access_token,
            refresh_token: retryAuth.session.refresh_token,
            employee: { emp_no: emp.emp_no, name: emp.name, site_code: emp.site_code_1, role: "field_member" },
          }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        return new Response(JSON.stringify({
          access_token: fieldAuth.session.access_token,
          refresh_token: fieldAuth.session.refresh_token,
          employee: { emp_no: emp.emp_no, name: emp.name, site_code: emp.site_code_1, role: "field_member" },
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      return new Response(JSON.stringify({
        access_token: authData.session.access_token,
        refresh_token: authData.session.refresh_token,
        employee: { emp_no: emp.emp_no, name: emp.name, site_code: emp.site_code_1, role: "crew" },
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: `알 수 없는 action: ${action}` }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "서버 오류" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
