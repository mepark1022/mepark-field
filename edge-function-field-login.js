// ═══════════════════════════════════════════════════════════════
// admin-api Edge Function에 추가할 field_login 핸들러
// Supabase Dashboard → Edge Functions → admin-api → 수정
// ═══════════════════════════════════════════════════════════════
//
// 기존 admin-api/index.ts의 switch(action) 블록에 아래 case 추가:

/*
case "field_login": {
  const { emp_id, pin } = body;
  if (!emp_id || !pin) {
    return new Response(JSON.stringify({ error: "emp_id와 pin이 필요합니다." }), { status: 400 });
  }

  // 1. employees 테이블에서 직원 조회
  const { data: emp, error: empErr } = await adminClient
    .from("employees")
    .select("id, name, emp_id, site_code, work_type, field_pin, auth_user_id, status, field_role")
    .eq("emp_id", emp_id.trim().toUpperCase())
    .single();

  if (empErr || !emp) {
    return new Response(JSON.stringify({ error: "등록되지 않은 사번입니다." }), { status: 401 });
  }

  if (emp.status !== "active") {
    return new Response(JSON.stringify({ error: "재직 중인 직원이 아닙니다." }), { status: 401 });
  }

  if (!emp.field_pin) {
    return new Response(JSON.stringify({ error: "PIN이 설정되지 않았습니다. 관리자에게 문의하세요." }), { status: 401 });
  }

  // 2. PIN 검증 (평문 비교, 추후 bcrypt 해시 비교로 업그레이드 가능)
  if (emp.field_pin !== pin) {
    return new Response(JSON.stringify({ error: "PIN이 올바르지 않습니다." }), { status: 401 });
  }

  // 3. auth_user_id가 없으면 자동으로 Auth 계정 생성
  let authUserId = emp.auth_user_id;
  if (!authUserId) {
    const email = `${emp_id.toLowerCase()}@field.mepark.internal`;
    const password = `MP_FIELD_${pin}_${emp.id.slice(0, 8)}`;

    // 계정 생성 시도
    const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        emp_id: emp.emp_id,
        name: emp.name,
        role: emp.field_role || "field_staff",
        site_code: emp.site_code,
      },
    });

    if (createErr && !createErr.message.includes("already registered")) {
      return new Response(JSON.stringify({ error: "계정 생성 실패: " + createErr.message }), { status: 500 });
    }

    // 이미 있는 경우 조회
    if (createErr) {
      const { data: userList } = await adminClient.auth.admin.listUsers();
      const existing = userList?.users?.find(u => u.email === email);
      authUserId = existing?.id;
    } else {
      authUserId = newUser?.user?.id;
    }

    // employees에 auth_user_id 저장
    if (authUserId) {
      await adminClient.from("employees").update({ auth_user_id: authUserId }).eq("id", emp.id);
    }
  }

  if (!authUserId) {
    return new Response(JSON.stringify({ error: "Auth 계정을 찾을 수 없습니다." }), { status: 500 });
  }

  // 4. 해당 사용자의 세션 토큰 생성
  const email = `${emp_id.toLowerCase()}@field.mepark.internal`;
  const password = `MP_FIELD_${pin}_${emp.id.slice(0, 8)}`;

  const { data: signInData, error: signInErr } = await adminClient.auth.signInWithPassword({
    email,
    password,
  });

  if (signInErr || !signInData?.session) {
    // 비밀번호가 변경된 경우 재설정
    await adminClient.auth.admin.updateUserById(authUserId, { password });
    const { data: retryData, error: retryErr } = await adminClient.auth.signInWithPassword({ email, password });
    if (retryErr || !retryData?.session) {
      return new Response(JSON.stringify({ error: "세션 생성 실패" }), { status: 500 });
    }
    return new Response(JSON.stringify({
      access_token: retryData.session.access_token,
      refresh_token: retryData.session.refresh_token,
      employee: {
        id: emp.id, name: emp.name, emp_id: emp.emp_id,
        site_code: emp.site_code, work_type: emp.work_type,
        field_role: emp.field_role || "field_staff",
      },
    }), { status: 200 });
  }

  return new Response(JSON.stringify({
    access_token: signInData.session.access_token,
    refresh_token: signInData.session.refresh_token,
    employee: {
      id: emp.id, name: emp.name, emp_id: emp.emp_id,
      site_code: emp.site_code, work_type: emp.work_type,
      field_role: emp.field_role || "field_staff",
    },
  }), { status: 200 });
}
*/

// ─── 사용 방법 ─────────────────────────────────────────────────────────────
// 1. Supabase Dashboard → Edge Functions → admin-api → Edit
// 2. 위 case "field_login" 블록을 switch(action) 안에 붙여넣기
// 3. Save & Deploy
