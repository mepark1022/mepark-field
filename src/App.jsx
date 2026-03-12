import { useState, useEffect, useCallback } from "react";
import { supabase, callAdminApi } from "./supabase.js";

// ─── 브랜드 컬러 ────────────────────────────────────────────────────────
const C = {
  navy:       "#1428A0",
  navyDark:   "#0e1d7a",
  navyLight:  "#1e38c4",
  gold:       "#F5B731",
  goldDark:   "#d4a020",
  white:      "#FFFFFF",
  dark:       "#222222",
  gray:       "#666666",
  lightGray:  "#F5F6FA",
  border:     "#E0E3EE",
  red:        "#E53935",
  green:      "#43A047",
  orange:     "#E97132",
};

// ─── 상수 ────────────────────────────────────────────────────────────────
const APP_VERSION = "v8.3";

// ─── 저장소 키 ────────────────────────────────────────────────────────────
const STORAGE_EMP_ID_KEY = "mepark_field_emp_id";

// ─── 유틸 ────────────────────────────────────────────────────────────────
function getSiteName(siteCode) {
  const map = {
    V000: "기획운영팀(본사)", V001: "사업장 1", V002: "사업장 2",
    V003: "사업장 3",        V004: "사업장 4", V005: "사업장 5",
    V006: "사업장 6",        V007: "사업장 7", V008: "사업장 8",
    V009: "사업장 9",        V010: "사업장 10", V011: "사업장 11",
    V012: "사업장 12",       V013: "사업장 13", V014: "사업장 14",
    V015: "사업장 15",       V016: "사업장 16",
  };
  return map[siteCode] || siteCode;
}

// ─── 로딩 스피너 ──────────────────────────────────────────────────────────
function Spinner({ size = 24, color = C.navy }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      border: `3px solid ${color}30`,
      borderTopColor: color,
      animation: "spin 0.8s linear infinite",
      display: "inline-block",
    }} />
  );
}

// ─── 로그인 화면 ──────────────────────────────────────────────────────────
function LoginPage({ onLogin }) {
  const [step, setStep] = useState("empId"); // "empId" | "pin"
  const [empId, setEmpId] = useState(() => localStorage.getItem(STORAGE_EMP_ID_KEY) || "");
  const [pin, setPin]     = useState(""); // 4자리
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState("");
  const [empName, setEmpName] = useState(""); // 사번 확인 후 이름 표시용

  // 사번 확인 → PIN 입력 단계로
  async function handleEmpIdNext() {
    if (!empId.trim()) { setError("사번을 입력해주세요."); return; }
    setError("");
    setLoading(true);
    try {
      // employees에서 사번 존재 여부 확인 (이름만 가져오기)
      const { data, error: dbErr } = await supabase
        .from("employees")
        .select("name, emp_id, status")
        .eq("emp_id", empId.trim().toUpperCase())
        .single();

      if (dbErr || !data) {
        setError("등록되지 않은 사번입니다. 관리자에게 문의하세요.");
        return;
      }
      if (data.status !== "active") {
        setError("재직 중인 직원이 아닙니다. 관리자에게 문의하세요.");
        return;
      }
      // 사번 저장 (다음 번 자동완성)
      localStorage.setItem(STORAGE_EMP_ID_KEY, empId.trim().toUpperCase());
      setEmpName(data.name);
      setStep("pin");
    } catch (e) {
      setError(e.message || "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  // PIN 키패드 입력
  function handlePinKey(key) {
    if (key === "del") {
      setPin(p => p.slice(0, -1));
      setError("");
      return;
    }
    if (pin.length >= 4) return;
    const next = pin + key;
    setPin(next);
    setError("");
    // 4자리 완성 시 자동 로그인 시도
    if (next.length === 4) {
      setTimeout(() => handlePinLogin(next), 150); // 마지막 버튼 애니메이션 후
    }
  }

  async function handlePinLogin(pinValue) {
    setLoading(true);
    setError("");
    try {
      // Edge Function 경유 로그인
      const result = await callAdminApi({
        action: "field_login",
        emp_id: empId.trim().toUpperCase(),
        pin: pinValue,
      });

      if (result.error) throw new Error(result.error);
      if (!result.access_token) throw new Error("로그인 처리 실패");

      // Supabase 세션 설정
      const { data: sessionData, error: sessionErr } = await supabase.auth.setSession({
        access_token: result.access_token,
        refresh_token: result.refresh_token,
      });
      if (sessionErr) throw sessionErr;

      onLogin({
        session: sessionData.session,
        employee: result.employee,
      });
    } catch (e) {
      setError(e.message || "PIN이 올바르지 않습니다.");
      setPin("");
    } finally {
      setLoading(false);
    }
  }

  // PIN 키패드 레이아웃
  const pinKeys = [
    ["1","2","3"],
    ["4","5","6"],
    ["7","8","9"],
    ["","0","del"],
  ];

  return (
    <div style={{
      minHeight: "100vh",
      background: `linear-gradient(160deg, ${C.navy} 0%, ${C.navyDark} 50%, #050d3d 100%)`,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "24px 20px",
    }}>
      {/* 로고 영역 */}
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <div style={{
          width: 80, height: 80, borderRadius: 24,
          background: C.gold,
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 16px",
          boxShadow: `0 8px 32px ${C.gold}40`,
        }}>
          <span style={{ fontSize: 40 }}>🅿️</span>
        </div>
        <div style={{ color: C.white, fontSize: 26, fontWeight: 900, letterSpacing: "-0.5px" }}>
          ME.PARK
        </div>
        <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 13, marginTop: 4 }}>
          현장 크루 마감보고 {APP_VERSION}
        </div>
      </div>

      {/* 카드 */}
      <div style={{
        width: "100%", maxWidth: 380,
        background: C.white,
        borderRadius: 24,
        padding: "28px 24px 32px",
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
      }}>
        {/* ── STEP 1: 사번 입력 ── */}
        {step === "empId" && (
          <>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: C.dark, marginBottom: 6 }}>
                사번 입력
              </div>
              <div style={{ fontSize: 13, color: C.gray }}>
                ME.PARK 사번을 입력해주세요
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: C.gray, display: "block", marginBottom: 6 }}>
                사번 (Employee ID)
              </label>
              <input
                type="text"
                value={empId}
                onChange={e => { setEmpId(e.target.value.toUpperCase()); setError(""); }}
                onKeyDown={e => e.key === "Enter" && handleEmpIdNext()}
                placeholder="예: MP24110, MPA1"
                autoComplete="username"
                autoCapitalize="characters"
                style={{
                  width: "100%", padding: "14px 16px",
                  border: `2px solid ${error ? C.red : C.border}`,
                  borderRadius: 12, fontSize: 16, fontWeight: 700,
                  color: C.dark, background: C.lightGray,
                  outline: "none", letterSpacing: 1,
                  transition: "border-color 0.2s",
                }}
              />
            </div>

            {error && (
              <div style={{
                background: "#fef2f2", border: `1px solid #fca5a5`,
                borderRadius: 10, padding: "10px 14px",
                color: C.red, fontSize: 13, fontWeight: 600,
                marginBottom: 16,
              }}>
                ⚠️ {error}
              </div>
            )}

            <button
              onClick={handleEmpIdNext}
              disabled={loading || !empId.trim()}
              style={{
                width: "100%", padding: "15px",
                background: loading || !empId.trim() ? C.border : C.navy,
                color: loading || !empId.trim() ? C.gray : C.white,
                border: "none", borderRadius: 14,
                fontSize: 16, fontWeight: 800,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                transition: "all 0.2s",
              }}
            >
              {loading ? <Spinner size={20} color={C.white} /> : "다음 →"}
            </button>
          </>
        )}

        {/* ── STEP 2: PIN 입력 ── */}
        {step === "pin" && (
          <>
            <div style={{ marginBottom: 20 }}>
              <button
                onClick={() => { setStep("empId"); setPin(""); setError(""); }}
                style={{
                  background: "none", border: "none", color: C.gray,
                  fontSize: 13, fontWeight: 600, padding: "0 0 8px",
                  display: "flex", alignItems: "center", gap: 4,
                }}
              >
                ← 사번 변경
              </button>
              <div style={{ fontSize: 20, fontWeight: 800, color: C.dark, marginBottom: 4 }}>
                안녕하세요, <span style={{ color: C.navy }}>{empName}</span>님!
              </div>
              <div style={{ fontSize: 13, color: C.gray }}>
                4자리 PIN을 입력해주세요
              </div>
            </div>

            {/* PIN 도트 표시 */}
            <div style={{
              display: "flex", gap: 14, justifyContent: "center",
              marginBottom: 24,
            }}>
              {[0,1,2,3].map(i => (
                <div key={i} style={{
                  width: 18, height: 18, borderRadius: "50%",
                  background: i < pin.length ? C.navy : "transparent",
                  border: `2.5px solid ${i < pin.length ? C.navy : C.border}`,
                  transition: "all 0.15s",
                  transform: i < pin.length ? "scale(1.15)" : "scale(1)",
                }} />
              ))}
            </div>

            {error && (
              <div style={{
                background: "#fef2f2", border: `1px solid #fca5a5`,
                borderRadius: 10, padding: "10px 14px",
                color: C.red, fontSize: 13, fontWeight: 600,
                marginBottom: 16, textAlign: "center",
              }}>
                ⚠️ {error}
              </div>
            )}

            {/* PIN 키패드 */}
            {loading ? (
              <div style={{ textAlign: "center", padding: "32px 0" }}>
                <Spinner size={36} color={C.navy} />
                <div style={{ color: C.gray, fontSize: 13, marginTop: 12 }}>로그인 중...</div>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                {pinKeys.flat().map((key, idx) => {
                  if (!key) return <div key={idx} />;
                  const isDel = key === "del";
                  return (
                    <button
                      key={idx}
                      onClick={() => handlePinKey(key)}
                      style={{
                        padding: "18px 0",
                        background: isDel ? "#fef3f3" : C.lightGray,
                        border: `1.5px solid ${isDel ? "#fca5a5" : C.border}`,
                        borderRadius: 14,
                        fontSize: isDel ? 18 : 24,
                        fontWeight: isDel ? 600 : 700,
                        color: isDel ? C.red : C.dark,
                        transition: "all 0.1s",
                        active: { transform: "scale(0.95)" },
                      }}
                      onTouchStart={e => e.currentTarget.style.background = isDel ? "#fee2e2" : C.border}
                      onTouchEnd={e => e.currentTarget.style.background = isDel ? "#fef3f3" : C.lightGray}
                      onMouseDown={e => e.currentTarget.style.background = isDel ? "#fee2e2" : C.border}
                      onMouseUp={e => e.currentTarget.style.background = isDel ? "#fef3f3" : C.lightGray}
                    >
                      {isDel ? "⌫" : key}
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* 하단 안내 */}
      <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, marginTop: 24, textAlign: "center" }}>
        PIN을 모를 경우 관리자에게 문의하세요
      </div>

      {/* 스핀 애니메이션 */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

// ─── 홈 화면 (로그인 후 — Part 2에서 완성) ────────────────────────────────
function HomePage({ employee, onLogout }) {
  const today = new Date().toLocaleDateString("ko-KR", {
    year: "numeric", month: "long", day: "numeric", weekday: "short",
  });

  return (
    <div style={{ minHeight: "100vh", background: C.lightGray }}>
      {/* 상단 헤더 */}
      <div style={{
        background: C.navy, color: C.white,
        padding: "env(safe-area-inset-top, 0) 0 0",
      }}>
        <div style={{ padding: "16px 20px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginBottom: 4 }}>
                🅿️ ME.PARK 현장앱
              </div>
              <div style={{ fontSize: 20, fontWeight: 900 }}>
                {employee?.name || "크루"}님, 안녕하세요!
              </div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", marginTop: 4 }}>
                {employee?.site_code ? getSiteName(employee.site_code) : ""} · {today}
              </div>
            </div>
            <button
              onClick={onLogout}
              style={{
                background: "rgba(255,255,255,0.15)",
                border: "none", borderRadius: 10,
                color: "rgba(255,255,255,0.8)",
                padding: "8px 14px", fontSize: 13, fontWeight: 600,
              }}
            >
              로그아웃
            </button>
          </div>
        </div>
      </div>

      {/* 컨텐츠 (Part 2에서 완성) */}
      <div style={{ padding: "24px 20px" }}>
        <div style={{
          background: C.white, borderRadius: 20,
          padding: "32px 24px", textAlign: "center",
          boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: C.dark, marginBottom: 8 }}>
            마감보고 준비 중
          </div>
          <div style={{ fontSize: 14, color: C.gray, lineHeight: 1.6 }}>
            파트 2에서 일보 입력 화면이 추가됩니다.<br />
            로그인이 정상적으로 완료되었습니다! ✅
          </div>
          <div style={{
            marginTop: 20, padding: "12px 16px",
            background: C.lightGray, borderRadius: 12,
            fontSize: 13, color: C.gray,
          }}>
            <strong style={{ color: C.navy }}>사번:</strong> {employee?.emp_id} &nbsp;|&nbsp;
            <strong style={{ color: C.navy }}>근무형태:</strong> {employee?.work_type || "-"}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 앱 루트 ──────────────────────────────────────────────────────────────
export default function App() {
  const [authState, setAuthState] = useState("loading"); // "loading" | "login" | "home"
  const [employee, setEmployee] = useState(null);

  // 기존 세션 확인
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        // 세션이 있으면 employees에서 직원 정보 로드
        loadEmployee(session.user.id);
      } else {
        setAuthState("login");
      }
    });

    // 세션 변경 감지
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        setEmployee(null);
        setAuthState("login");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadEmployee(authUserId) {
    try {
      const { data, error } = await supabase
        .from("employees")
        .select("id, name, emp_id, site_code, work_type, status")
        .eq("auth_user_id", authUserId)
        .single();

      if (error || !data) throw new Error("직원 정보를 찾을 수 없습니다.");
      setEmployee(data);
      setAuthState("home");
    } catch (e) {
      console.error("직원 정보 로드 실패:", e);
      await supabase.auth.signOut();
      setAuthState("login");
    }
  }

  function handleLogin({ session, employee: emp }) {
    setEmployee(emp);
    setAuthState("home");
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    localStorage.removeItem("mepark_field_emp_id"); // 로그아웃 시에도 사번은 유지 (편의성)
    setEmployee(null);
    setAuthState("login");
  }

  // 로딩 중
  if (authState === "loading") {
    return (
      <div style={{
        minHeight: "100vh",
        background: `linear-gradient(160deg, ${C.navy} 0%, #050d3d 100%)`,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 20,
      }}>
        <div style={{ fontSize: 48 }}>🅿️</div>
        <Spinner size={40} color={C.gold} />
        <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>로딩 중...</div>
      </div>
    );
  }

  if (authState === "login") {
    return <LoginPage onLogin={handleLogin} />;
  }

  return <HomePage employee={employee} onLogout={handleLogout} />;
}
