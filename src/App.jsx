import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
const APP_VERSION = "v1.0";
const STORAGE_EMP_ID_KEY = "mepark_field_emp_id";
const STORAGE_PHONE_KEY  = "mepark_field_saved_phone";
const FONT = "'Noto Sans KR', -apple-system, BlinkMacSystemFont, sans-serif";

const DUTY_TYPES = [
  { key: "site",    label: "해당매장",  color: "#1428A0", bg: "#eef0ff" },
  { key: "hq",      label: "본사지원",  color: "#E97132", bg: "#fff4ec" },
  { key: "part",    label: "알바지원",  color: "#43A047", bg: "#edf7ee" },
  { key: "extra",   label: "비번투입",  color: "#8B5CF6", bg: "#f3f0ff" },
];

const PAYMENT_TYPES = [
  { key: "cash",     label: "현금",     icon: "💵" },
  { key: "card",     label: "카드",     icon: "💳" },
  { key: "transfer", label: "계좌이체", icon: "🏦" },
  { key: "etc",      label: "기타",     icon: "📋" },
];

// ─── 사업장 마스터 (ERP와 동기화된 기본값) ──────────────────────────────
const SITES_DEFAULT = {
  V000: "기획운영팀(본사)", V001: "강원빌딩",          V002: "사계절한정식",
  V003: "신한은행(서초)",   V004: "장안면옥",          V005: "한티옥(방이)",
  V006: "청담우리동물병원", V007: "미니쉬치과병원",    V008: "쥬비스(삼성)",
  V009: "모모빌딩",         V010: "곽생로여성의원",    V011: "금돈옥(청담)",
  V012: "금돈옥(잠실)",     V013: "써브라임",          V014: "더캐리",
  V015: "강서푸른빛성모어린이병원",                    V016: "SC제일은행PPC(압구정)",
};

// DB 로드된 사업장명을 앱 전역에서 참조 (App 컴포넌트에서 주입)
let _siteNamesCache = { ...SITES_DEFAULT };

function getSiteName(siteCode) {
  return _siteNamesCache[siteCode] || SITES_DEFAULT[siteCode] || siteCode;
}

function updateSiteNamesCache(map) {
  _siteNamesCache = { ...SITES_DEFAULT, ...map };
}

function getToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" });
}

function formatDateFull(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "short" });
}

const toNum = (v) => { const n = Number(v); return isNaN(n) ? 0 : n; };
const fmt = (n) => (n == null || n === "" || isNaN(n)) ? "0" : Math.round(Number(n)).toLocaleString("ko-KR");

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

// ─── 토스트 알림 ──────────────────────────────────────────────────────────
function Toast({ message, type = "success", onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div style={{
      position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)",
      zIndex: 9999, padding: "12px 24px",
      background: type === "success" ? C.green : type === "error" ? C.red : C.navy,
      color: C.white, borderRadius: 14, fontSize: 14, fontWeight: 700,
      boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
      animation: "slideDown 0.3s ease-out",
      fontFamily: FONT, maxWidth: "90vw", textAlign: "center",
    }}>
      {type === "success" ? "✅" : type === "error" ? "❌" : "ℹ️"} {message}
    </div>
  );
}

// ─── 공통 NumInput ────────────────────────────────────────────────────────
function NumInput({ value, onChange, placeholder, suffix, style: st }) {
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState(value ? String(value) : "");

  useEffect(() => {
    if (!focused) setText(value ? String(value) : "");
  }, [value, focused]);

  return (
    <div style={{ position: "relative", ...st }}>
      <input
        inputMode="decimal"
        value={focused ? text : (value ? fmt(value) : "")}
        placeholder={placeholder || "0"}
        onFocus={() => { setFocused(true); setText(value ? String(value) : ""); }}
        onBlur={() => { setFocused(false); onChange(toNum(text)); }}
        onChange={e => setText(e.target.value.replace(/[^0-9.-]/g, ""))}
        style={{
          width: "100%", padding: "12px 14px",
          paddingRight: suffix ? 36 : 14,
          border: `2px solid ${focused ? C.navy : C.border}`,
          borderRadius: 12, fontSize: 16, fontWeight: 700,
          color: C.dark, background: C.lightGray,
          outline: "none", textAlign: "right",
          fontFamily: FONT, transition: "border-color 0.2s",
        }}
      />
      {suffix && <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", color: C.gray, fontSize: 13, fontWeight: 600 }}>{suffix}</span>}
    </div>
  );
}

// ─── 로그인 화면 ──────────────────────────────────────────────────────────
function LoginPage({ onLogin }) {
  // loginMode: "phone"(기본) | "empId"(사번 모드)
  const [loginMode, setLoginMode] = useState("phone");

  // ── 전화번호 모드 state ──
  const [seg1, setSeg1] = useState("");  // 4자리
  const [seg2, setSeg2] = useState("");  // 4자리
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [phoneError, setPhoneError] = useState("");
  const [rememberPhone, setRememberPhone] = useState(() => !!localStorage.getItem(STORAGE_PHONE_KEY));
  // 실패 횟수 잠금
  const [failCount, setFailCount] = useState(0);
  const [lockUntil, setLockUntil] = useState(null);

  // 저장된 전화번호 복원
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_PHONE_KEY);
      if (saved) {
        const d = JSON.parse(saved);
        if (d.s1 && d.s2 && d.s1.length === 4 && d.s2.length === 4) {
          setSeg1(d.s1); setSeg2(d.s2);
        }
      }
    } catch (_) {}
  }, []);

  // ── 사번+PIN 모드 state ──
  const [step, setStep] = useState("empId");
  const [empId, setEmpId] = useState(() => localStorage.getItem(STORAGE_EMP_ID_KEY) || "");
  const [pin, setPin]     = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState("");
  const [empName, setEmpName] = useState("");

  function getPhoneDigits() { return "010" + seg1 + seg2; }
  function isPhoneComplete() { return seg1.length === 4 && seg2.length === 4; }

  function handleSeg1Change(e) {
    const v = e.target.value.replace(/\D/g, "").slice(0, 4);
    setSeg1(v); setPhoneError("");
    if (v.length === 4) { document.getElementById("mpLoginSeg2")?.focus(); }
    if (v.length === 4 && seg2.length === 4) { setTimeout(() => handlePhoneLogin("010" + v + seg2), 300); }
  }
  function handleSeg2Change(e) {
    const v = e.target.value.replace(/\D/g, "").slice(0, 4);
    setSeg2(v); setPhoneError("");
    if (v.length === 4 && seg1.length === 4) { setTimeout(() => handlePhoneLogin("010" + seg1 + v), 300); }
  }

  function toggleRememberPhone() {
    const next = !rememberPhone;
    setRememberPhone(next);
    if (next) {
      try { localStorage.setItem(STORAGE_PHONE_KEY, JSON.stringify({ s1: seg1, s2: seg2 })); } catch (_) {}
    } else {
      try { localStorage.removeItem(STORAGE_PHONE_KEY); } catch (_) {}
    }
  }

  async function handlePhoneLogin(phoneVal) {
    // 잠금 체크
    if (lockUntil && Date.now() < lockUntil) {
      const sec = Math.ceil((lockUntil - Date.now()) / 1000);
      setPhoneError(`로그인 시도가 너무 많습니다. ${sec}초 후 다시 시도하세요.`);
      return;
    }
    const digits = (phoneVal || getPhoneDigits()).replace(/\D/g, "");
    if (digits.length !== 11) { setPhoneError("전화번호 11자리를 입력해주세요."); return; }

    setPhoneLoading(true);
    setPhoneError("");
    try {
      // Edge Function 없이 Supabase RPC로 직접 처리
      const { data: empRows, error: rpcErr } = await supabase.rpc("get_emp_by_phone", { p_phone: digits });
      if (rpcErr) throw new Error("서버 오류: " + rpcErr.message);
      if (!empRows || empRows.length === 0) {
        const newFail = failCount + 1;
        setFailCount(newFail);
        if (newFail >= 5) { setLockUntil(Date.now() + 3 * 60 * 1000); setFailCount(0); throw new Error("5회 실패로 3분간 잠금됩니다."); }
        throw new Error("등록되지 않은 전화번호입니다.");
      }
      const emp = empRows[0];
      // pin4 = RPC 반환값 || 입력 전화번호 뒤 4자리 (비밀번호 규칙: mp + 뒤4자리)
      const pin4 = emp.pin4 || digits.slice(-4);
      const empNo = emp.emp_no;
      const empUUID = emp.emp_uuid || emp.emp_id || "";
      const accountEmail = emp.account_email || "";
      const systemRole = emp.system_role || "field_member";
      const empInfo = { emp_no: empNo, emp_id: empNo, name: emp.emp_name, site_code: emp.site_code, work_type: emp.work_code };
      const pass = `mp${pin4}`;

      // ① empno@mepark.internal 시도 (crew)
      const { data: auth1, error: err1 } = await supabase.auth.signInWithPassword({
        email: `${empNo.toLowerCase()}@mepark.internal`, password: pass,
      });
      if (!err1 && auth1?.session) {
        setFailCount(0);
        if (rememberPhone) { try { localStorage.setItem(STORAGE_PHONE_KEY, JSON.stringify({ s1: seg1, s2: seg2 })); } catch (_) {} }
        onLogin({ session: auth1.session, employee: { ...empInfo, role: systemRole !== "field_member" ? systemRole : "crew" } });
        return;
      }

      // ② account_email 시도 (admin/super_admin — 실계정 이메일)
      if (accountEmail) {
        const { data: auth2, error: err2 } = await supabase.auth.signInWithPassword({
          email: accountEmail, password: pass,
        });
        if (!err2 && auth2?.session) {
          setFailCount(0);
          if (rememberPhone) { try { localStorage.setItem(STORAGE_PHONE_KEY, JSON.stringify({ s1: seg1, s2: seg2 })); } catch (_) {} }
          onLogin({ session: auth2.session, employee: { ...empInfo, role: systemRole } });
          return;
        }
      }

      // ③ empno@field.mepark.internal 시도 (field_member) — 비밀번호: mp{pin4}
      const { data: auth3, error: err3 } = await supabase.auth.signInWithPassword({
        email: `${empNo.toLowerCase()}@field.mepark.internal`,
        password: `mp${pin4}`,
      });
      if (!err3 && auth3?.session) {
        setFailCount(0);
        if (rememberPhone) { try { localStorage.setItem(STORAGE_PHONE_KEY, JSON.stringify({ s1: seg1, s2: seg2 })); } catch (_) {} }
        onLogin({ session: auth3.session, employee: { ...empInfo, role: "field_member" } });
        return;
      }

      // ④ field_login Edge Function 시도
      const result = await callAdminApi({ action: "field_login", emp_id: empNo, pin: pin4 });
      if (!result.error && result.access_token) {
        const { data: sessionData } = await supabase.auth.setSession({ access_token: result.access_token, refresh_token: result.refresh_token });
        setFailCount(0);
        if (rememberPhone) { try { localStorage.setItem(STORAGE_PHONE_KEY, JSON.stringify({ s1: seg1, s2: seg2 })); } catch (_) {} }
        onLogin({ session: sessionData.session, employee: { ...empInfo, ...result.employee } });
        return;
      }

      // 관리자 계정인 경우 사번 로그인 안내
      if (systemRole === "admin" || systemRole === "super_admin") {
        throw new Error("관리자 계정입니다. 하단의 '사번으로 로그인'을 이용해주세요.");
      }

      const newFail = failCount + 1;
      setFailCount(newFail);
      if (newFail >= 5) { setLockUntil(Date.now() + 3 * 60 * 1000); setFailCount(0); throw new Error("5회 실패로 3분간 잠금됩니다."); }
      throw new Error("로그인 실패. 관리자에게 문의하세요.");
    } catch (e) {
      setPhoneError(e.message || "등록되지 않은 전화번호입니다.");
    } finally {
      setPhoneLoading(false);
    }
  }

  // ── 사번 모드 함수 ──
  async function handleEmpIdNext() {
    if (!empId.trim()) { setError("사번을 입력해주세요."); return; }
    const id = empId.trim().toUpperCase();
    if (!/^MP[A-Z]?\d+$/.test(id)) {
      setError("사번 형식이 올바르지 않습니다. (예: MP24101)");
      return;
    }
    localStorage.setItem(STORAGE_EMP_ID_KEY, id);
    setEmpName(id);
    setStep("pin");
  }

  function handlePinKey(key) {
    if (key === "del") { setPin(p => p.slice(0, -1)); setError(""); return; }
    if (pin.length >= 4) return;
    const next = pin + key;
    setPin(next);
    setError("");
    if (next.length === 4) setTimeout(() => handlePinLogin(next), 150);
  }

  async function handlePinLogin(pinValue) {
    setLoading(true);
    setError("");
    const id = empId.trim().toUpperCase();
    try {
      const email = `${id.toLowerCase()}@mepark.internal`;
      const password = `mp${pinValue}`;
      const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({ email, password });
      if (!authErr && authData?.user) {
        const { data: prof } = await supabase.from("profiles")
          .select("name, site_code, role, emp_no").eq("id", authData.user.id).single();
        if (prof) {
          onLogin({
            session: authData.session,
            employee: { name: prof.name, emp_no: prof.emp_no || id, emp_id: prof.emp_no || id, site_code: prof.site_code, role: prof.role }
          });
          return;
        }
      }
      const result = await callAdminApi({ action: "field_login", emp_id: id, pin: pinValue });
      if (result.error) throw new Error("PIN이 올바르지 않습니다.");
      if (!result.access_token) throw new Error("로그인 처리 실패");
      const { data: sessionData, error: sessionErr } = await supabase.auth.setSession({
        access_token: result.access_token, refresh_token: result.refresh_token,
      });
      if (sessionErr) throw sessionErr;
      onLogin({ session: sessionData.session, employee: result.employee });
    } catch (e) {
      setError("PIN이 올바르지 않습니다.");
      setPin("");
    } finally {
      setLoading(false);
    }
  }

  const pinKeys = [["1","2","3"],["4","5","6"],["7","8","9"],["","0","del"]];

  return (
    <div style={{
      minHeight: "100vh",
      background: `linear-gradient(160deg, ${C.navy} 0%, ${C.navyDark} 50%, #050d3d 100%)`,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "24px 20px",
    }}>
      {/* 미팍티켓 공식 로고 */}
      <div style={{ textAlign: "center", marginBottom: 36 }}>
        {/* P 아이콘 */}
        <div style={{
          width: 88, height: 88, borderRadius: 24,
          background: "#fff", border: "3.5px solid #1A1D2B",
          position: "relative", overflow: "hidden",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 18px",
          boxShadow: "0 10px 40px rgba(0,0,0,0.35)",
        }}>
          {/* 골드 바 (하단) */}
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0,
            height: 22, background: C.gold,
          }} />
          {/* P 글자 */}
          <span style={{
            fontFamily: "Outfit, Arial, sans-serif",
            fontSize: 44, fontWeight: 900, color: "#1A1D2B",
            position: "relative", zIndex: 1, marginTop: -10,
            lineHeight: 1,
          }}>P</span>
        </div>
        {/* 미팍Ticket 텍스트 */}
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 2, marginBottom: 6 }}>
          <span style={{
            fontFamily: "'Noto Sans KR', sans-serif",
            fontSize: 28, fontWeight: 900, color: "#fff", letterSpacing: "-0.5px",
          }}>미팍</span>
          <span style={{
            fontFamily: "Outfit, Arial, sans-serif",
            fontSize: 28, fontWeight: 700, color: C.gold, letterSpacing: "-0.5px",
          }}>Ticket</span>
        </div>
        <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 13 }}>현장크루 마감보고 앱 {APP_VERSION}</div>
      </div>

      {/* 카드 */}
      <div style={{
        width: "100%", maxWidth: 380, background: C.white,
        borderRadius: 24, padding: "28px 24px 32px",
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
      }}>

        {/* ── 전화번호 모드 ── */}
        {loginMode === "phone" && (
          <>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: C.dark, marginBottom: 6 }}>📱 전화번호로 로그인</div>
              <div style={{ fontSize: 13, color: C.gray }}>등록된 전화번호를 입력하면 자동 로그인됩니다</div>
            </div>

            <div style={{ marginBottom: 4 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: C.gray, display: "block", marginBottom: 6 }}>전화번호</label>
              {/* 010 고정 + 분리 입력 */}
              <div style={{
                display: "flex", alignItems: "center",
                border: `2px solid ${phoneError ? C.red : (seg1.length === 4 && seg2.length === 4) ? "#43A047" : C.border}`,
                borderRadius: 14, overflow: "hidden",
                background: "#fff", transition: "border-color 0.2s",
              }}>
                {/* 010 고정 */}
                <div style={{
                  background: "#F0F2FA", color: C.navy,
                  fontSize: 20, fontWeight: 800,
                  padding: "0 12px", height: 56,
                  display: "flex", alignItems: "center",
                  borderRight: `2px solid ${C.border}`,
                  letterSpacing: 1, flexShrink: 0, fontFamily: FONT,
                }}>010</div>
                {/* 구분선 */}
                <span style={{ color: C.border, fontSize: 20, padding: "0 4px", flexShrink: 0 }}>-</span>
                {/* 앞 4자리 */}
                <input
                  id="mpLoginSeg1"
                  type="tel" inputMode="numeric"
                  value={seg1}
                  onChange={handleSeg1Change}
                  onKeyDown={e => e.key === "Enter" && document.getElementById("mpLoginSeg2")?.focus()}
                  placeholder="0000"
                  maxLength={4}
                  autoComplete="off"
                  style={{
                    flex: 1, border: "none", outline: "none",
                    fontSize: 22, fontWeight: 800, textAlign: "center",
                    color: C.dark, background: "transparent",
                    letterSpacing: 3, fontFamily: FONT, height: 56,
                    minWidth: 0,
                  }}
                />
                <span style={{ color: C.border, fontSize: 20, padding: "0 4px", flexShrink: 0 }}>-</span>
                {/* 뒤 4자리 */}
                <input
                  id="mpLoginSeg2"
                  type="tel" inputMode="numeric"
                  value={seg2}
                  onChange={handleSeg2Change}
                  onKeyDown={e => {
                    if (e.key === "Backspace" && seg2 === "") document.getElementById("mpLoginSeg1")?.focus();
                    if (e.key === "Enter" && isPhoneComplete()) handlePhoneLogin();
                  }}
                  placeholder="0000"
                  maxLength={4}
                  autoComplete="off"
                  style={{
                    flex: 1, border: "none", outline: "none",
                    fontSize: 22, fontWeight: 800, textAlign: "center",
                    color: C.dark, background: "transparent",
                    letterSpacing: 3, fontFamily: FONT, height: 56,
                    minWidth: 0,
                  }}
                />
              </div>
              <div style={{ fontSize: 11, color: C.gray, marginTop: 6, textAlign: "center" }}>
                11자리 완성 시 자동 로그인 · 비밀번호 불필요
              </div>
            </div>

            {/* 아이디 기억하기 */}
            <div
              onClick={toggleRememberPhone}
              style={{ display: "flex", alignItems: "center", gap: 8, margin: "14px 0 18px", cursor: "pointer", userSelect: "none" }}
            >
              <div style={{
                width: 18, height: 18,
                borderRadius: 5,
                border: `1.5px solid ${rememberPhone ? C.navy : C.border}`,
                background: rememberPhone ? C.navy : "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, transition: "all 0.15s",
              }}>
                {rememberPhone && (
                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                    <path d="M1 4L3.5 6.5L9 1" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#555" }}>
                아이디 기억하기
                {rememberPhone && (
                  <span style={{
                    marginLeft: 6, background: "#EEF1FB", color: C.navy,
                    fontSize: 11, fontWeight: 700,
                    padding: "2px 8px", borderRadius: 6, display: "inline-block",
                  }}>저장됨</span>
                )}
              </span>
            </div>

            {phoneError && (
              <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 10, padding: "10px 14px", color: C.red, fontSize: 13, fontWeight: 600, marginBottom: 16, textAlign: "center" }}>
                ⚠️ {phoneError}
              </div>
            )}

            {phoneLoading ? (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <Spinner size={32} color={C.navy} />
                <div style={{ color: C.gray, fontSize: 13, marginTop: 10 }}>로그인 중...</div>
              </div>
            ) : (
              <button
                onClick={() => handlePhoneLogin()}
                disabled={!isPhoneComplete()}
                style={{
                  width: "100%", padding: "15px",
                  background: isPhoneComplete() ? C.navy : C.border,
                  color: C.white, border: "none", borderRadius: 14,
                  fontSize: 16, fontWeight: 800, fontFamily: FONT,
                  cursor: isPhoneComplete() ? "pointer" : "not-allowed",
                  transition: "background 0.2s",
                }}>
                로그인
              </button>
            )}

            {/* 사번 모드 전환 */}
            <div style={{ textAlign: "center", marginTop: 20 }}>
              <button onClick={() => { setLoginMode("empId"); setPhoneError(""); setSeg1(""); setSeg2(""); }}
                style={{ background: "none", border: "none", color: C.gray, fontSize: 12, fontWeight: 600, fontFamily: FONT, cursor: "pointer", textDecoration: "underline" }}>
                사번으로 로그인 (관리자/크루)
              </button>
            </div>
          </>
        )}

        {/* ── 사번+PIN 모드 ── */}
        {loginMode === "empId" && (
          <>
            {step === "empId" && (
              <>
                <div style={{ marginBottom: 20 }}>
                  <button onClick={() => { setLoginMode("phone"); setStep("empId"); setError(""); setPin(""); }}
                    style={{ background: "none", border: "none", color: C.gray, fontSize: 13, fontWeight: 600, marginBottom: 12, padding: 0, fontFamily: FONT, cursor: "pointer" }}>
                    ← 전화번호 로그인으로
                  </button>
                  <div style={{ fontSize: 20, fontWeight: 800, color: C.dark, marginBottom: 6 }}>사번 입력</div>
                  <div style={{ fontSize: 13, color: C.gray }}>관리자/크루 계정 전용</div>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: C.gray, display: "block", marginBottom: 6 }}>사번 (Employee ID)</label>
                  <input type="text" value={empId}
                    onChange={e => { setEmpId(e.target.value.toUpperCase()); setError(""); }}
                    onKeyDown={e => e.key === "Enter" && handleEmpIdNext()}
                    placeholder="예: MP24110, MPA1"
                    autoComplete="username" autoCapitalize="characters"
                    style={{
                      width: "100%", padding: "14px 16px",
                      border: `2px solid ${error ? C.red : C.border}`,
                      borderRadius: 12, fontSize: 16, fontWeight: 700,
                      color: C.dark, background: C.lightGray,
                      outline: "none", letterSpacing: 1, boxSizing: "border-box",
                    }}
                  />
                </div>
                {error && (
                  <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 10, padding: "10px 14px", color: C.red, fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
                    ⚠️ {error}
                  </div>
                )}
                <button onClick={handleEmpIdNext} disabled={loading || !empId.trim()}
                  style={{
                    width: "100%", padding: "15px",
                    background: loading || !empId.trim() ? C.border : C.navy,
                    color: C.white, border: "none", borderRadius: 14,
                    fontSize: 16, fontWeight: 800, fontFamily: FONT,
                  }}>
                  {loading ? "확인 중..." : "다음 →"}
                </button>
              </>
            )}

            {step === "pin" && (
              <>
                <div style={{ marginBottom: 20 }}>
                  <button onClick={() => { setStep("empId"); setPin(""); setError(""); }}
                    style={{ background: "none", border: "none", color: C.gray, fontSize: 13, fontWeight: 600, marginBottom: 12, padding: 0, fontFamily: FONT, cursor: "pointer" }}>
                    ← 사번 변경
                  </button>
                  <div style={{ fontSize: 20, fontWeight: 800, color: C.dark, marginBottom: 4 }}>
                    안녕하세요, <span style={{ color: C.navy }}>{empName}</span>님!
                  </div>
                  <div style={{ fontSize: 13, color: C.gray }}>4자리 PIN을 입력해주세요</div>
                </div>
                <div style={{ display: "flex", gap: 14, justifyContent: "center", marginBottom: 24 }}>
                  {[0,1,2,3].map(i => (
                    <div key={i} style={{
                      width: 18, height: 18, borderRadius: "50%",
                      background: i < pin.length ? C.navy : "transparent",
                      border: `2.5px solid ${i < pin.length ? C.navy : C.border}`,
                      transition: "all 0.15s", transform: i < pin.length ? "scale(1.15)" : "scale(1)",
                    }} />
                  ))}
                </div>
                {error && (
                  <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 10, padding: "10px 14px", color: C.red, fontSize: 13, fontWeight: 600, marginBottom: 16, textAlign: "center" }}>
                    ⚠️ {error}
                  </div>
                )}
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
                        <button key={idx} onClick={() => handlePinKey(key)}
                          style={{
                            padding: "18px 0", background: isDel ? "#fef3f3" : C.lightGray,
                            border: `1.5px solid ${isDel ? "#fca5a5" : C.border}`,
                            borderRadius: 14, fontSize: isDel ? 18 : 24,
                            fontWeight: isDel ? 600 : 700, color: isDel ? C.red : C.dark,
                            transition: "all 0.1s", fontFamily: FONT,
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
          </>
        )}
      </div>

      <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, marginTop: 24, textAlign: "center" }}>
        {loginMode === "phone" ? "전화번호가 등록되지 않은 경우 관리자에게 문의하세요" : "PIN을 모를 경우 관리자에게 문의하세요"}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── 일보 작성 폼 ────────────────────────────────────────────────────────
function ReportFormPage({ employee, editReport, editPayments, onSave, onBack }) {
  const today = getToday();
  const siteCode = employee?.site_code || "V001";
  const isEdit = !!editReport;

  // 오프라인 임시저장 키
  const DRAFT_KEY = `mepark_field_draft_${siteCode}_${today}`;

  const [siteEmployees, setSiteEmployees] = useState([]);
  const [hqEmployees, setHqEmployees] = useState([]);
  const [loadingStaff, setLoadingStaff] = useState(true);
  const [dutyTab, setDutyTab] = useState("site"); // "site" | "hq" | "part"
  const [partInput, setPartInput] = useState(""); // 알바 이름 입력
  const [draftRestored, setDraftRestored] = useState(false);
  const [valetRate, setValetRate] = useState(0); // 사업장 발렛 단가
  const [extraEnabled, setExtraEnabled] = useState(false); // 추가근무 ON/OFF
  const [extraTypes, setExtraTypes] = useState([]); // 유형 목록
  // extraWork: { [emp_no]: { typeId, typeName, payKind, start, end, amount } }
  const [extraWork, setExtraWork] = useState({});

  const [form, setForm] = useState(() => {
    // 수정 모드면 편집 데이터 우선
    if (editReport) {
      // 기존 selected_staff가 문자열 배열일 수 있으므로 호환 처리
      const rawStaff = editReport.selected_staff || [];
      const selectedStaff = rawStaff.map(s =>
        typeof s === "string" ? { emp_no: s, name: "", duty: "site" } : s
      );
      return {
        valet_count: editReport.valet_count || 0,
        valet_amount: editReport.valet_amount || 0,
        staff_count: editReport.staff_count || 0,
        selectedStaff,
        memo: editReport.memo || "",
        images: editReport.images || [],
        payList: PAYMENT_TYPES.map(pt => {
          const existing = (editPayments || []).find(p => p.payment_type === pt.key);
          return { payment_type: pt.key, count: existing?.count || 0, amount: existing?.amount || 0 };
        }),
      };
    }
    // 임시저장 복원 시도
    try {
      const saved = localStorage.getItem(`mepark_field_draft_${siteCode}_${today}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        // images는 Storage URL만 복원 (File 객체 없음 — path 없는 임시 URL은 제외)
        return { ...parsed, images: [] };
      }
    } catch (_) {}
    return {
      valet_count: 0, valet_amount: 0, staff_count: 0, selectedStaff: [], memo: "", images: [],
      payList: PAYMENT_TYPES.map(pt => ({ payment_type: pt.key, count: 0, amount: 0 })),
    };
  });

  // 사업장 직원 목록 로드
  useEffect(() => {
    async function loadSiteEmployees() {
      setLoadingStaff(true);
      try {
        const { data, error } = await supabase
          .from("employees")
          .select("id, emp_no, name, position, work_code, status")
          .eq("site_code_1", siteCode)
          .in("status", ["active", "재직"])
          .order("emp_no");
        if (!error && data) setSiteEmployees(data);
      } catch (e) {
        console.error("직원 목록 로드 실패:", e);
      } finally {
        setLoadingStaff(false);
      }
    }
    loadSiteEmployees();
  }, [siteCode]);

  // 본사(V000) 직원 목록 로드 (임원급 제외: 대표, 본부장)
  useEffect(() => {
    async function loadHqEmployees() {
      try {
        const { data } = await supabase
          .from("employees")
          .select("id, emp_no, name, position")
          .eq("site_code_1", "V000")
          .in("status", ["active", "재직"])
          .order("emp_no");
        if (data) {
          const EXCLUDE_POSITIONS = ["대표", "본부장"];
          setHqEmployees(data.filter(e => !EXCLUDE_POSITIONS.includes(e.position)));
        }
      } catch (e) { console.error("본사 직원 로드 실패:", e); }
    }
    loadHqEmployees();
  }, []);

  // 사업장 발렛 단가 로드
  useEffect(() => {
    async function loadValetRate() {
      try {
        const { data } = await supabase
          .from("site_details")
          .select("valet_rate")
          .eq("site_code", siteCode)
          .maybeSingle();
        if (data?.valet_rate) setValetRate(data.valet_rate);
      } catch (_) {}
    }
    loadValetRate();
  }, [siteCode]);

  // 사업장 추가근무 설정 로드
  useEffect(() => {
    async function loadExtraConfig() {
      try {
        const { data: cfg } = await supabase.from("site_extra_config").select("is_enabled").eq("site_code", siteCode).maybeSingle();
        if (!cfg?.is_enabled) return;
        setExtraEnabled(true);
        const { data: types } = await supabase.from("site_extra_types").select("*").eq("site_code", siteCode).order("sort_order");
        if (types) setExtraTypes(types);
      } catch (_) {}
    }
    loadExtraConfig();
  }, [siteCode]);

  // 오프라인 임시저장 — form 변경 시 1초 디바운스로 localStorage 저장 (신규 작성 모드만)
  useEffect(() => {
    if (isEdit) return; // 수정 모드는 임시저장 안 함
    const t = setTimeout(() => {
      try {
        const toSave = {
          valet_count: form.valet_count,
          valet_amount: form.valet_amount,
          staff_count: form.staff_count,
          selectedStaff: form.selectedStaff,
          memo: form.memo,
          payList: form.payList,
          // images는 Storage에 이미 올라갔으므로 저장
          images: form.images,
          _savedAt: new Date().toISOString(),
        };
        localStorage.setItem(DRAFT_KEY, JSON.stringify(toSave));
      } catch (_) {}
    }, 1000);
    return () => clearTimeout(t);
  }, [form, isEdit, DRAFT_KEY]);

  // 임시저장 복원 알림 표시
  useEffect(() => {
    if (isEdit) return;
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const hasData = parsed.valet_count > 0 || parsed.valet_amount > 0 || parsed.memo?.trim() || (parsed.selectedStaff?.length > 0);
        if (hasData) setDraftRestored(true);
      }
    } catch (_) {}
  }, [isEdit, DRAFT_KEY]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false); // 제출 확인 팝업

  const payTotal = useMemo(() => form.payList.reduce((s, p) => s + toNum(p.amount), 0), [form.payList]);
  // 건수 합산 (기타 제외) — valet_count 자동계산
  const autoValetCount = useMemo(() =>
    form.payList.filter(p => p.payment_type !== "etc").reduce((s, p) => s + toNum(p.count), 0),
    [form.payList]
  );

  function updatePay(idx, field, val) {
    setForm(f => {
      const updated = f.payList.map((p, i) => {
        if (i !== idx) return p;
        const newP = { ...p, [field]: val };
        // 건수 변경 시 기타 제외하고 단가 있으면 금액 자동계산
        if (field === "count" && p.payment_type !== "etc" && valetRate > 0) {
          newP.amount = toNum(val) * valetRate;
        }
        return newP;
      });
      return { ...f, payList: updated };
    });
  }

  // 사진 업로드
  async function handleImageUpload(e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    if (form.images.length + files.length > 5) {
      setError("사진은 최대 5장까지 첨부할 수 있습니다.");
      return;
    }
    setUploading(true);
    setError("");
    try {
      const newImages = [];
      for (const file of files) {
        if (file.size > 10 * 1024 * 1024) { setError("파일 크기는 10MB 이하만 가능합니다."); continue; }
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${siteCode}/${today}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { data, error: upErr } = await supabase.storage.from("daily-report-images").upload(path, file);
        if (upErr) { console.error("업로드 실패:", upErr); setError("사진 업로드에 실패했습니다."); continue; }
        const { data: urlData } = supabase.storage.from("daily-report-images").getPublicUrl(path);
        newImages.push({ path, url: urlData.publicUrl, name: file.name });
      }
      setForm(f => ({ ...f, images: [...f.images, ...newImages] }));
    } catch (err) {
      console.error("이미지 업로드 에러:", err);
      setError("사진 업로드 중 오류가 발생했습니다.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function removeImage(idx) {
    const img = form.images[idx];
    // Storage에서 실제 파일 삭제 (path가 있는 경우)
    if (img?.path) {
      try {
        await supabase.storage.from("daily-report-images").remove([img.path]);
      } catch (e) {
        console.warn("Storage 삭제 실패 (무시):", e);
      }
    }
    setForm(f => ({ ...f, images: f.images.filter((_, i) => i !== idx) }));
  }

  function handleConfirmOpen() {
    if (!form.selectedStaff || form.selectedStaff.length === 0) {
      setError("근무 직원을 1명 이상 선택해주세요.");
      return;
    }
    if (autoValetCount <= 0 && payTotal <= 0 && !form.memo?.trim()) {
      setError("최소 1개 이상의 항목을 입력해주세요.");
      return;
    }
    setError("");
    setShowConfirm(true);
  }

  async function handleSubmit() {
    setShowConfirm(false);
    setSaving(true);
    setError("");
    try {
      let reportId = editReport?.id;
      const reportPayload = {
        report_date: today,
        site_code: siteCode,
        valet_count: autoValetCount,
        valet_amount: payTotal,
        staff_count: toNum(form.staff_count),
        selected_staff: form.selectedStaff || [],
        memo: form.memo?.trim() || null,
        images: form.images || [],
        reporter_id: employee?.id || null,
        status: "submitted",
      };
      if (reportId) {
        const { error: ue } = await supabase.from("daily_reports").update(reportPayload).eq("id", reportId);
        if (ue) throw ue;
      } else {
        const { data: existing } = await supabase.from("daily_reports").select("id")
          .eq("report_date", today).eq("site_code", siteCode).maybeSingle();
        if (existing) {
          setError("오늘 이미 이 사업장의 일보가 제출되었습니다. 홈에서 수정해주세요.");
          setSaving(false);
          return;
        }
        const { data, error: ie } = await supabase.from("daily_reports").insert(reportPayload).select().single();
        if (ie) throw ie;
        reportId = data.id;
      }
      // 결제수단 저장
      await supabase.from("daily_report_payment").delete().eq("report_id", reportId);
      const payRows = form.payList
        .filter(p => toNum(p.count) > 0 || toNum(p.amount) > 0)
        .map(p => ({ report_id: reportId, payment_type: p.payment_type, count: toNum(p.count), amount: toNum(p.amount), memo: null }));
      if (payRows.length > 0) {
        const { error: pe } = await supabase.from("daily_report_payment").insert(payRows);
        if (pe) throw pe;
      }
      // 근무직원 저장 (daily_report_staff — 근태현황 연동)
      await supabase.from("daily_report_staff").delete().eq("report_id", reportId);
      const staffRows = (form.selectedStaff || []).map(s => {
        const ex = extraWork[s.emp_no];
        return {
          report_id: reportId,
          employee_id: s.employee_id || null,
          name_raw: s.duty === "part" ? s.name : null,
          staff_type: s.duty || "site",
          work_hours: 0,
          extra_type_id: ex?.typeId || null,
          extra_type_name: ex?.typeName || null,
          extra_start: ex?.start || null,
          extra_end: ex?.end || null,
          extra_minutes: ex?.minutes || null,
          extra_amount: ex?.amount || null,
        };
      });
      if (staffRows.length > 0) {
        const { error: se } = await supabase.from("daily_report_staff").insert(staffRows);
        if (se) console.error("staff 저장 실패:", se);
      }
      onSave();
      // 성공 시 임시저장 삭제
      try { localStorage.removeItem(DRAFT_KEY); } catch (_) {}
    } catch (e) {
      console.error("일보 저장 실패:", e);
      setError(e.message || "저장에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setSaving(false);
    }
  }

  const sectionStyle = { background: C.white, borderRadius: 20, padding: "20px", marginBottom: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.05)" };
  const sectionTitle = (icon, title) => (
    <div style={{ fontSize: 15, fontWeight: 800, color: C.navy, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
      <span>{icon}</span> {title}
    </div>
  );
  const labelStyle = { fontSize: 12, fontWeight: 700, color: C.gray, display: "block", marginBottom: 6 };

  return (
    <div style={{ minHeight: "100vh", background: C.lightGray, fontFamily: FONT }}>
      {/* 헤더 */}
      <div style={{ background: C.navy, color: C.white, padding: "env(safe-area-inset-top, 0) 0 0" }}>
        <div style={{ padding: "12px 20px 16px", display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={onBack} style={{
            background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 10,
            color: C.white, padding: "8px 12px", fontSize: 16, fontWeight: 700, fontFamily: FONT,
          }}>←</button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 900 }}>{isEdit ? "📝 일보 수정" : "📝 일보 작성"}</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>
              {getSiteName(siteCode)} · {formatDateFull(today)}
            </div>
          </div>
        </div>
      </div>

      {/* 폼 */}
      <div style={{ padding: "16px 16px 120px" }}>
        {/* 임시저장 복원 알림 */}
        {draftRestored && !isEdit && (
          <div style={{
            background: "#fff8e1", border: `1.5px solid ${C.gold}`,
            borderRadius: 14, padding: "12px 16px", marginBottom: 14,
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#7a5c00" }}>
              💾 오늘 작성 중이던 임시저장 내용이 복원됐어요
            </div>
            <button
              onClick={() => {
                try { localStorage.removeItem(DRAFT_KEY); } catch (_) {}
                setDraftRestored(false);
                setForm({
                  valet_count: 0, valet_amount: 0, staff_count: 0, selectedStaff: [], memo: "", images: [],
                  payList: PAYMENT_TYPES.map(pt => ({ payment_type: pt.key, count: 0, amount: 0 })),
                });
              }}
              style={{
                background: "transparent", border: `1.5px solid ${C.gold}`,
                borderRadius: 8, padding: "4px 10px",
                fontSize: 12, fontWeight: 700, color: "#7a5c00", fontFamily: FONT,
                whiteSpace: "nowrap",
              }}
            >초기화</button>
          </div>
        )}

        {/* 기본 정보 */}
        <div style={sectionStyle}>
          {sectionTitle("📍", "기본 정보")}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={labelStyle}>사업장</label>
              <div style={{ padding: "10px 12px", background: "#e8ebf5", borderRadius: 12, fontSize: 13, fontWeight: 700, color: C.navy, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {getSiteName(siteCode)}
              </div>
            </div>
            <div>
              <label style={labelStyle}>보고일</label>
              <div style={{ padding: "10px 12px", background: "#e8ebf5", borderRadius: 12, fontSize: 13, fontWeight: 700, color: C.navy, whiteSpace: "nowrap" }}>
                {formatDate(today)}
              </div>
            </div>
          </div>
        </div>

        {/* 근무 현황 */}
        <div style={sectionStyle}>
          {sectionTitle("👥", "근무 현황")}

          {/* 총 인원 표시 */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ display: "flex", gap: 6 }}>
              {DUTY_TYPES.map(d => {
                const cnt = form.selectedStaff.filter(s => s.duty === d.key).length;
                return cnt > 0 ? (
                  <span key={d.key} style={{ fontSize: 11, fontWeight: 800, color: d.color,
                    background: d.bg, padding: "3px 9px", borderRadius: 20 }}>
                    {d.label} {cnt}명
                  </span>
                ) : null;
              })}
            </div>
            <div style={{ fontSize: 14, fontWeight: 900, color: C.navy, background: "#e8ebf5", padding: "4px 12px", borderRadius: 20 }}>
              총 {form.selectedStaff.length}명
            </div>
          </div>

          {/* 탭 */}
          <div style={{ display: "flex", background: "#f0f2f7", borderRadius: 12, padding: 4, marginBottom: 14, gap: 4 }}>
            {DUTY_TYPES.map(d => (
              <button key={d.key} onClick={() => setDutyTab(d.key)} style={{
                flex: 1, padding: "8px 4px", borderRadius: 9, border: "none",
                background: dutyTab === d.key ? C.white : "transparent",
                color: dutyTab === d.key ? d.color : C.gray,
                fontSize: 12, fontWeight: 800, fontFamily: FONT,
                boxShadow: dutyTab === d.key ? "0 2px 8px rgba(0,0,0,0.08)" : "none",
                transition: "all 0.15s",
              }}>
                {d.label}
                {form.selectedStaff.filter(s => s.duty === d.key).length > 0 && (
                  <span style={{ marginLeft: 4, background: d.color, color: C.white,
                    fontSize: 10, borderRadius: 10, padding: "1px 5px" }}>
                    {form.selectedStaff.filter(s => s.duty === d.key).length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ── 해당매장 탭 ── */}
          {dutyTab === "site" && (
            loadingStaff ? (
              <div style={{ textAlign: "center", padding: "16px 0" }}>
                <Spinner size={24} color={C.navy} />
                <div style={{ fontSize: 12, color: C.gray, marginTop: 8 }}>로딩 중...</div>
              </div>
            ) : siteEmployees.length === 0 ? (
              <div style={{ textAlign: "center", padding: "16px 0", color: C.gray, fontSize: 13 }}>
                등록된 직원이 없습니다.
              </div>
            ) : (
              <>
                <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                  <button onClick={() => {
                    const allSite = siteEmployees.map(e => ({ emp_no: e.emp_no, name: e.name, duty: "site", employee_id: e.id }));
                    setForm(f => {
                      const others = f.selectedStaff.filter(s => s.duty !== "site");
                      const next = [...others, ...allSite];
                      return { ...f, selectedStaff: next, staff_count: next.length };
                    });
                  }} style={{ flex: 1, padding: "8px", border: `1.5px solid ${C.navy}`, borderRadius: 10,
                    background: form.selectedStaff.filter(s=>s.duty==="site").length === siteEmployees.length ? C.navy : C.white,
                    color: form.selectedStaff.filter(s=>s.duty==="site").length === siteEmployees.length ? C.white : C.navy,
                    fontSize: 12, fontWeight: 700, fontFamily: FONT }}>
                    ✅ 전체 선택
                  </button>
                  <button onClick={() => setForm(f => {
                    const next = f.selectedStaff.filter(s => s.duty !== "site");
                    return { ...f, selectedStaff: next, staff_count: next.length };
                  })} style={{ flex: 1, padding: "8px", border: `1.5px solid ${C.border}`, borderRadius: 10,
                    background: C.white, color: C.gray, fontSize: 12, fontWeight: 700, fontFamily: FONT }}>
                    ↩️ 초기화
                  </button>
                </div>
                <div style={{ display: "grid", gap: 6, maxHeight: 280, overflowY: "auto" }}>
                  {siteEmployees.map(emp => {
                    const isSelected = form.selectedStaff.some(s => s.emp_no === emp.emp_no && s.duty === "site");
                    return (
                      <button key={emp.emp_no} onClick={() => {
                        setForm(f => {
                          const exists = f.selectedStaff.find(s => s.emp_no === emp.emp_no);
                          const next = exists
                            ? f.selectedStaff.filter(s => s.emp_no !== emp.emp_no)
                            : [...f.selectedStaff, { emp_no: emp.emp_no, name: emp.name, duty: "site", employee_id: emp.id }];
                          return { ...f, selectedStaff: next, staff_count: next.length };
                        });
                      }} style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "10px 14px", borderRadius: 12, border: "none",
                        border: `1.5px solid ${isSelected ? C.navy + "60" : C.border}`,
                        background: isSelected ? "#eef0ff" : C.white,
                        textAlign: "left", fontFamily: FONT, cursor: "pointer",
                      }}>
                        <div style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                          border: `2px solid ${isSelected ? C.navy : C.border}`,
                          background: isSelected ? C.navy : C.white,
                          display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {isSelected && <span style={{ color: C.white, fontSize: 13, fontWeight: 900 }}>✓</span>}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: C.dark }}>{emp.name}</div>
                          <div style={{ fontSize: 11, color: C.gray, marginTop: 1 }}>
                            {emp.emp_no} · {emp.position || ""} {emp.work_code ? `(${emp.work_code})` : ""}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )
          )}

          {/* ── 추가근무 입력 섹션 (site 탭 + extraEnabled + site 직원 선택됨) ── */}
          {dutyTab === "site" && extraEnabled && extraTypes.length > 0 && form.selectedStaff.filter(s => s.duty === "site").length > 0 && (() => {
            const siteStaff = form.selectedStaff.filter(s => s.duty === "site");
            const HALF_HOURS = [];
            for (let h = 0; h < 24; h++) for (let m of [0, 30]) HALF_HOURS.push(`${String(h).padStart(2,"0")}:${m===0?"00":"30"}`);
            const calcExtra = (type, startStr, endStr) => {
              if (!type) return 0;
              if (type.pay_kind === "fixed") return type.fixed_amount || 0;
              if (!startStr || !endStr) return 0;
              const [sh, sm] = startStr.split(":").map(Number);
              const [eh, em] = endStr.split(":").map(Number);
              const mins = (eh * 60 + em) - (sh * 60 + sm);
              if (mins <= 0) return 0;
              const pay = Math.round((type.hourly_rate || 0) * mins / 60);
              const meal = (type.meal_trigger && mins > type.meal_trigger) ? (type.meal_amount || 0) : 0;
              return pay + meal;
            };
            const setEmpExtra = (empNo, patch) => {
              setExtraWork(prev => {
                const cur = prev[empNo] || {};
                const next = { ...cur, ...patch };
                if (patch.typeId !== undefined) {
                  const t = extraTypes.find(x => x.id === patch.typeId);
                  next.typeName = t?.type_name || "";
                  next.payKind = t?.pay_kind || "";
                  if (t?.pay_kind === "fixed") { next.start = null; next.end = null; next.minutes = t.fixed_min; next.amount = t.fixed_amount; }
                }
                if (next.payKind === "hourly" && next.start && next.end) {
                  const t = extraTypes.find(x => x.id === next.typeId);
                  const [sh, sm] = next.start.split(":").map(Number);
                  const [eh, em] = next.end.split(":").map(Number);
                  const mins = (eh*60+em)-(sh*60+sm);
                  next.minutes = mins > 0 ? mins : 0;
                  next.amount = calcExtra(t, next.start, next.end);
                }
                return { ...prev, [empNo]: next };
              });
            };
            return (
              <div style={{ marginTop: 14, borderTop: `2px solid #E8E0FF`, paddingTop: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#6D28D9", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ background: "#EDE9FE", borderRadius: 8, padding: "2px 8px" }}>💰 추가수당 입력</span>
                  <span style={{ fontSize: 10, color: "#A78BFA", fontWeight: 600 }}>해당 직원만 선택</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {siteStaff.map(s => {
                    const ex = extraWork[s.emp_no] || {};
                    const selType = extraTypes.find(t => t.id === ex.typeId);
                    return (
                      <div key={s.emp_no} style={{ background: ex.typeId ? "#F5F3FF" : C.white, border: `1.5px solid ${ex.typeId ? "#A78BFA" : C.border}`, borderRadius: 12, overflow: "hidden" }}>
                        {/* 직원 헤더 */}
                        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: ex.typeId ? "1px solid #E8E0FF" : "none" }}>
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#43A047", flexShrink: 0 }} />
                          <span style={{ fontSize: 13, fontWeight: 700, color: C.dark, flex: 1 }}>{s.name}</span>
                          {ex.typeId && (
                            <button onClick={() => setExtraWork(p => { const n = { ...p }; delete n[s.emp_no]; return n; })} style={{ fontSize: 10, padding: "3px 8px", borderRadius: 6, border: `1px solid ${C.border}`, background: "#fff", color: C.gray, cursor: "pointer", fontFamily: FONT }}>초기화</button>
                          )}
                        </div>
                        {/* 유형 선택 (라디오) */}
                        <div style={{ padding: "8px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
                          {/* 없음 옵션 */}
                          <button onClick={() => setExtraWork(p => { const n = { ...p }; delete n[s.emp_no]; return n; })} style={{
                            display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 8, cursor: "pointer", fontFamily: FONT,
                            border: `1.5px solid ${!ex.typeId ? "#6D28D9" : C.border}`, background: !ex.typeId ? "#EDE9FE" : "#fff", textAlign: "left",
                          }}>
                            <div style={{ width: 14, height: 14, borderRadius: "50%", border: `2px solid ${!ex.typeId ? "#6D28D9" : C.border}`, background: !ex.typeId ? "#6D28D9" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              {!ex.typeId && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff" }} />}
                            </div>
                            <span style={{ fontSize: 12, fontWeight: 600, color: !ex.typeId ? "#6D28D9" : C.gray }}>없음</span>
                          </button>
                          {extraTypes.map(t => {
                            const isSel = ex.typeId === t.id;
                            return (
                              <div key={t.id} style={{ border: `1.5px solid ${isSel ? "#6D28D9" : C.border}`, borderRadius: 10, background: isSel ? "#F5F3FF" : "#fff", overflow: "hidden" }}>
                                <button onClick={() => setEmpExtra(s.emp_no, { typeId: t.id })} style={{
                                  display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 10px", width: "100%", border: "none", background: "transparent", cursor: "pointer", fontFamily: FONT, textAlign: "left",
                                }}>
                                  <div style={{ width: 14, height: 14, borderRadius: "50%", border: `2px solid ${isSel ? "#6D28D9" : C.border}`, background: isSel ? "#6D28D9" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                                    {isSel && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff" }} />}
                                  </div>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: isSel ? "#4C1D95" : C.dark }}>{t.type_name}</div>
                                    <div style={{ fontSize: 10, color: C.gray, marginTop: 1 }}>
                                      {t.pay_kind === "fixed" ? `${t.fixed_min}분 고정 · ${(t.fixed_amount||0).toLocaleString("ko-KR")}원` : `30분 단위 · ${(t.hourly_rate||0).toLocaleString("ko-KR")}원/h`}
                                      {t.meal_trigger && <span style={{ color: "#D97706" }}> · {t.meal_trigger}분 초과 시 식대+{(t.meal_amount||0).toLocaleString("ko-KR")}원</span>}
                                    </div>
                                  </div>
                                </button>
                                {/* 시급제: 시간 입력 */}
                                {isSel && t.pay_kind === "hourly" && (
                                  <div style={{ padding: "0 10px 10px", display: "flex", alignItems: "center", gap: 6 }}>
                                    <span style={{ fontSize: 11, color: C.gray, flexShrink: 0 }}>시작</span>
                                    <select value={ex.start || ""} onChange={e => setEmpExtra(s.emp_no, { start: e.target.value })} style={{ flex: 1, padding: "6px 8px", border: `1.5px solid #A78BFA`, borderRadius: 8, fontSize: 12, fontWeight: 600, fontFamily: FONT, background: "#fff", outline: "none" }}>
                                      <option value="">선택</option>
                                      {HALF_HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                                    </select>
                                    <span style={{ fontSize: 11, color: C.gray }}>—</span>
                                    <span style={{ fontSize: 11, color: C.gray, flexShrink: 0 }}>종료</span>
                                    <select value={ex.end || ""} onChange={e => setEmpExtra(s.emp_no, { end: e.target.value })} style={{ flex: 1, padding: "6px 8px", border: `1.5px solid #A78BFA`, borderRadius: 8, fontSize: 12, fontWeight: 600, fontFamily: FONT, background: "#fff", outline: "none" }}>
                                      <option value="">선택</option>
                                      {HALF_HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                                    </select>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          {/* 금액 계산 결과 */}
                          {ex.typeId && (
                            <div style={{ background: C.navy, borderRadius: 8, padding: "6px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.7)" }}>
                                {selType?.pay_kind === "fixed" ? `${selType.fixed_min}분` : ex.minutes > 0 ? `${ex.minutes}분 (${(ex.minutes/60).toFixed(1)}h)` : "시간 선택"}
                              </span>
                              <span style={{ fontSize: 13, fontWeight: 800, color: ex.amount > 0 ? "#F5B731" : "rgba(255,255,255,0.4)" }}>
                                {ex.amount > 0 ? `+${ex.amount.toLocaleString("ko-KR")}원` : "-"}
                                {selType?.meal_trigger && ex.minutes > selType.meal_trigger && <span style={{ fontSize: 10, color: "#86EFAC", marginLeft: 4 }}>🍱포함</span>}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* ── 본사지원 탭 ── */}
          {dutyTab === "hq" && (
            hqEmployees.length === 0 ? (
              <div style={{ textAlign: "center", padding: "16px 0", color: C.gray, fontSize: 13 }}>
                본사 직원 정보가 없습니다.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 6, maxHeight: 320, overflowY: "auto" }}>
                {hqEmployees.map(emp => {
                  const isSelected = form.selectedStaff.some(s => s.emp_no === emp.emp_no && s.duty === "hq");
                  return (
                    <button key={emp.emp_no} onClick={() => {
                      setForm(f => {
                        const exists = f.selectedStaff.find(s => s.emp_no === emp.emp_no);
                        const next = exists
                          ? f.selectedStaff.filter(s => s.emp_no !== emp.emp_no)
                          : [...f.selectedStaff, { emp_no: emp.emp_no, name: emp.name, duty: "hq", employee_id: emp.id }];
                        return { ...f, selectedStaff: next, staff_count: next.length };
                      });
                    }} style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "10px 14px", borderRadius: 12,
                      border: `1.5px solid ${isSelected ? "#E97132" + "60" : C.border}`,
                      background: isSelected ? "#fff4ec" : C.white,
                      textAlign: "left", fontFamily: FONT, cursor: "pointer",
                    }}>
                      <div style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                        border: `2px solid ${isSelected ? "#E97132" : C.border}`,
                        background: isSelected ? "#E97132" : C.white,
                        display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {isSelected && <span style={{ color: C.white, fontSize: 13, fontWeight: 900 }}>✓</span>}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: C.dark }}>{emp.name}</div>
                        <div style={{ fontSize: 11, color: C.gray, marginTop: 1 }}>
                          {emp.emp_no} · {emp.position || ""}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )
          )}

          {/* ── 알바지원 탭 ── */}
          {dutyTab === "part" && (
            <div>
              {/* 이름 수기입력 */}
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <input
                  value={partInput}
                  onChange={e => setPartInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && partInput.trim()) {
                      const name = partInput.trim();
                      const emp_no = `PART_${Date.now()}`;
                      setForm(f => {
                        const next = [...f.selectedStaff, { emp_no, name, duty: "part" }];
                        return { ...f, selectedStaff: next, staff_count: next.length };
                      });
                      setPartInput("");
                    }
                  }}
                  placeholder="이름 입력 후 추가"
                  style={{ flex: 1, padding: "11px 14px", border: `2px solid ${C.border}`, borderRadius: 12,
                    fontSize: 14, fontFamily: FONT, outline: "none", color: C.dark, background: C.lightGray }}
                />
                <button onClick={() => {
                  if (!partInput.trim()) return;
                  const name = partInput.trim();
                  const emp_no = `PART_${Date.now()}`;
                  setForm(f => {
                    const next = [...f.selectedStaff, { emp_no, name, duty: "part" }];
                    return { ...f, selectedStaff: next, staff_count: next.length };
                  });
                  setPartInput("");
                }} style={{ padding: "11px 16px", background: "#43A047", color: C.white,
                  border: "none", borderRadius: 12, fontSize: 14, fontWeight: 800, fontFamily: FONT, cursor: "pointer" }}>
                  추가
                </button>
              </div>

              {/* 추가된 알바 목록 */}
              {form.selectedStaff.filter(s => s.duty === "part").length === 0 ? (
                <div style={{ textAlign: "center", padding: "20px 0", color: C.gray, fontSize: 13 }}>
                  추가된 알바 없음<br/>
                  <span style={{ fontSize: 11 }}>이름을 입력하고 추가 버튼을 누르세요</span>
                </div>
              ) : (
                <div style={{ display: "grid", gap: 6 }}>
                  {form.selectedStaff.filter(s => s.duty === "part").map(emp => (
                    <div key={emp.emp_no} style={{ display: "flex", alignItems: "center", gap: 10,
                      padding: "10px 14px", borderRadius: 12,
                      border: `1.5px solid #43A04740`, background: "#edf7ee" }}>
                      <span style={{ fontSize: 16 }}>👤</span>
                      <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: C.dark }}>{emp.name}</span>
                      <button onClick={() => setForm(f => {
                        const next = f.selectedStaff.filter(s => s.emp_no !== emp.emp_no);
                        return { ...f, selectedStaff: next, staff_count: next.length };
                      })} style={{ background: "none", border: "none", cursor: "pointer",
                        fontSize: 18, color: C.gray, padding: "2px 6px", lineHeight: 1 }}>
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {/* ── 추가근무 탭 ── */}
          {dutyTab === "extra" && (
            loadingStaff ? (
              <div style={{ textAlign: "center", padding: "16px 0" }}>
                <Spinner size={24} color="#8B5CF6" />
                <div style={{ fontSize: 12, color: C.gray, marginTop: 8 }}>로딩 중...</div>
              </div>
            ) : siteEmployees.length === 0 ? (
              <div style={{ textAlign: "center", padding: "16px 0", color: C.gray, fontSize: 13 }}>
                등록된 직원이 없습니다.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 6, maxHeight: 280, overflowY: "auto" }}>
                {siteEmployees.map(emp => {
                  const extraKey = `${emp.emp_no}_extra`;
                  const isSelected = form.selectedStaff.some(s => s.emp_no === extraKey);
                  return (
                    <button key={emp.emp_no} onClick={() => {
                      setForm(f => {
                        const exists = f.selectedStaff.find(s => s.emp_no === extraKey);
                        const next = exists
                          ? f.selectedStaff.filter(s => s.emp_no !== extraKey)
                          : [...f.selectedStaff, { emp_no: extraKey, name: emp.name, duty: "extra", employee_id: emp.id }];
                        return { ...f, selectedStaff: next, staff_count: next.length };
                      });
                    }} style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "10px 14px", borderRadius: 12,
                      border: `1.5px solid ${isSelected ? "#8B5CF660" : C.border}`,
                      background: isSelected ? "#f3f0ff" : C.white,
                      textAlign: "left", fontFamily: FONT, cursor: "pointer",
                    }}>
                      <div style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                        border: `2px solid ${isSelected ? "#8B5CF6" : C.border}`,
                        background: isSelected ? "#8B5CF6" : C.white,
                        display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {isSelected && <span style={{ color: C.white, fontSize: 13, fontWeight: 900 }}>✓</span>}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: C.dark }}>{emp.name}</div>
                        <div style={{ fontSize: 11, color: C.gray, marginTop: 1 }}>
                          {emp.emp_no} · {emp.position || ""} {emp.work_code ? `(${emp.work_code})` : ""}
                        </div>
                      </div>
                      {isSelected && (
                        <span style={{ fontSize: 10, fontWeight: 800, color: "#8B5CF6",
                          background: C.white, padding: "2px 7px", borderRadius: 20,
                          border: "1.5px solid #8B5CF640", flexShrink: 0 }}>추가근무</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )
          )}
        </div>

        <div style={sectionStyle}>
          {sectionTitle("💰", "발렛비")}

          {/* 단가 표시 */}
          {valetRate > 0 ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
              background: "#EEF2FF", borderRadius: 10, padding: "10px 14px", marginBottom: 12 }}>
              <span style={{ fontSize: 12, color: C.navy, fontWeight: 700 }}>💡 설정 단가</span>
              <span style={{ fontSize: 15, fontWeight: 900, color: C.navy, fontFamily: "monospace" }}>{fmt(valetRate)}원/건</span>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: C.gray, marginBottom: 12, padding: "8px 12px",
              background: "#fff7ed", borderRadius: 10, border: `1px solid ${C.orange}40` }}>
              ⚠️ ERP 사업장관리에서 발렛 단가를 먼저 설정해주세요
            </div>
          )}

          {/* 발렛비 총액 자동표시 */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 16px", background: autoValetCount > 0 ? "#f0f2ff" : C.lightGray,
            borderRadius: 12, border: `1.5px solid ${autoValetCount > 0 ? C.navy + "40" : C.border}` }}>
            <div>
              <div style={{ fontSize: 11, color: C.gray, fontWeight: 600 }}>총 건수</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: C.navy, fontFamily: "monospace" }}>{autoValetCount}건</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, color: C.gray, fontWeight: 600 }}>발렛비 합계</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: C.navy, fontFamily: "monospace" }}>{fmt(payTotal)}원</div>
            </div>
          </div>
          <div style={{ fontSize: 11, color: C.gray, marginTop: 6, textAlign: "right" }}>
            ※ 아래 결제수단별 건수 입력 시 자동 계산됩니다
          </div>
        </div>

        {/* 결제 수단 */}
        <div style={sectionStyle}>
          {sectionTitle("💳", "결제 수단별 매출")}
          <div style={{ display: "grid", gap: 12 }}>
            {form.payList.map((p, idx) => {
              const pt = PAYMENT_TYPES.find(t => t.key === p.payment_type);
              const isEtc = p.payment_type === "etc";
              const hasAmount = toNum(p.amount) > 0;
              return (
                <div key={p.payment_type} style={{
                  border: `1.5px solid ${hasAmount ? C.navy + "40" : C.border}`,
                  borderRadius: 14, padding: "14px",
                  background: hasAmount ? "#f0f2ff" : C.white,
                  transition: "all 0.2s",
                }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: C.dark, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                    {pt?.icon} {pt?.label}
                    {!isEtc && valetRate > 0 && (
                      <span style={{ fontSize: 10, color: C.gray, fontWeight: 500, marginLeft: "auto" }}>
                        건당 {fmt(valetRate)}원
                      </span>
                    )}
                  </div>
                  {isEtc ? (
                    /* 기타: 금액 수기입력 */
                    <div>
                      <label style={{ ...labelStyle, fontSize: 11 }}>금액</label>
                      <NumInput value={p.amount} onChange={v => updatePay(idx, "amount", v)} suffix="원" />
                    </div>
                  ) : (
                    /* 현금/카드/계좌이체: 건수 입력 → 금액 자동계산 */
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1.8fr", gap: 8 }}>
                      <div>
                        <label style={{ ...labelStyle, fontSize: 11 }}>건수</label>
                        <NumInput value={p.count} onChange={v => updatePay(idx, "count", v)} suffix="건" />
                      </div>
                      <div>
                        <label style={{ ...labelStyle, fontSize: 11 }}>금액{valetRate > 0 ? " (자동)" : ""}</label>
                        <NumInput value={p.amount} onChange={v => updatePay(idx, "amount", v)} suffix="원" />
                      </div>
                    </div>
                  )}
                  {/* 건수 있을 때 건당 계산 표시 */}
                  {!isEtc && toNum(p.count) > 0 && toNum(p.amount) > 0 && (
                    <div style={{ fontSize: 11, color: C.gray, textAlign: "right", marginTop: 4 }}>
                      {toNum(p.count)}건 × {fmt(valetRate > 0 ? valetRate : Math.round(toNum(p.amount) / toNum(p.count)))}원
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {/* 결제 합계 */}
          <div style={{
            marginTop: 14, padding: "14px 16px", background: C.navy, borderRadius: 14,
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span style={{ color: "rgba(255,255,255,0.8)", fontSize: 13, fontWeight: 700 }}>결제 합계</span>
            <span style={{ color: C.gold, fontSize: 20, fontWeight: 900, fontFamily: "monospace" }}>{fmt(payTotal)}원</span>
          </div>
        </div>

        {/* 사진 첨부 (카드영수증 등) */}
        <div style={sectionStyle}>
          {sectionTitle("📷", "마감 사진 첨부")}
          <div style={{ fontSize: 12, color: C.gray, marginBottom: 12 }}>
            카드영수증, 마감정산서 등을 촬영해주세요 (최대 5장)
          </div>

          {/* 업로드된 이미지 미리보기 */}
          {form.images.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
              {form.images.map((img, idx) => (
                <div key={idx} style={{ position: "relative", borderRadius: 12, overflow: "hidden", aspectRatio: "1", background: C.lightGray }}>
                  <img
                    src={img.url} alt={img.name || "사진"}
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                  <button onClick={() => removeImage(idx)}
                    style={{
                      position: "absolute", top: 4, right: 4,
                      width: 24, height: 24, borderRadius: "50%",
                      background: "rgba(0,0,0,0.6)", color: C.white,
                      border: "none", fontSize: 14, fontWeight: 700,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>×</button>
                </div>
              ))}
            </div>
          )}

          {/* 업로드 버튼 */}
          {form.images.length < 5 && (
            <div>
              <input
                type="file" accept="image/*" multiple capture="environment"
                id="photo-upload"
                onChange={handleImageUpload}
                style={{ display: "none" }}
              />
              <button
                onClick={() => document.getElementById("photo-upload").click()}
                disabled={uploading}
                style={{
                  width: "100%", padding: "14px",
                  background: uploading ? C.lightGray : C.white,
                  border: `2px dashed ${uploading ? C.border : C.navy}`,
                  borderRadius: 14, fontSize: 14, fontWeight: 700,
                  color: uploading ? C.gray : C.navy, fontFamily: FONT,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}
              >
                {uploading ? (
                  <><Spinner size={18} color={C.navy} /> 업로드 중...</>
                ) : (
                  <>📷 {form.images.length > 0 ? "사진 추가" : "사진 촬영 / 선택"}</>
                )}
              </button>
            </div>
          )}

          {form.images.length > 0 && (
            <div style={{ marginTop: 8, fontSize: 12, color: C.gray, textAlign: "right" }}>
              {form.images.length}/5장 첨부됨
            </div>
          )}
        </div>

        {/* 특이사항 */}
        <div style={sectionStyle}>
          {sectionTitle("📝", "특이사항")}
          <textarea
            value={form.memo}
            onChange={e => setForm(f => ({ ...f, memo: e.target.value }))}
            placeholder="특이사항이 있으면 작성해주세요 (선택사항)"
            rows={4}
            style={{
              width: "100%", padding: "12px 14px",
              border: `2px solid ${C.border}`, borderRadius: 12,
              fontSize: 14, color: C.dark, background: C.lightGray,
              outline: "none", resize: "vertical", fontFamily: FONT, lineHeight: 1.6,
            }}
          />
        </div>

        {error && (
          <div style={{
            padding: "12px 16px", background: "#fef2f2",
            border: `1.5px solid #fca5a5`, borderRadius: 14,
            color: C.red, fontSize: 13, fontWeight: 700, marginBottom: 16,
          }}>
            ⚠️ {error}
          </div>
        )}
      </div>

      {/* 제출 확인 팝업 */}
      {showConfirm && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
          display: "flex", alignItems: "flex-end", justifyContent: "center",
          zIndex: 1000, padding: "0 0 env(safe-area-inset-bottom)",
        }}>
          <div style={{
            background: C.white, borderRadius: "24px 24px 0 0",
            width: "100%", maxWidth: 480, padding: "24px 20px 32px",
            boxShadow: "0 -8px 40px rgba(0,0,0,0.15)",
          }}>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>📋</div>
              <div style={{ fontSize: 17, fontWeight: 900, color: C.dark }}>일보 제출 확인</div>
              <div style={{ fontSize: 12, color: C.gray, marginTop: 4 }}>{getSiteName(siteCode)} · {formatDate(today)}</div>
            </div>

            {/* 근무 현황 요약 */}
            <div style={{ background: "#f5f6fa", borderRadius: 14, padding: "14px 16px", marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: C.navy, marginBottom: 10 }}>👥 근무 현황 ({form.selectedStaff.length}명)</div>
              {form.selectedStaff.length === 0 ? (
                <div style={{ fontSize: 12, color: C.gray }}>선택된 직원 없음</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {DUTY_TYPES.map(d => {
                    const members = form.selectedStaff.filter(s => s.duty === d.key);
                    if (members.length === 0) return null;
                    return (
                      <div key={d.key} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                        <span style={{ fontSize: 10, fontWeight: 800, color: d.color,
                          background: d.bg, padding: "2px 7px", borderRadius: 20, flexShrink: 0, marginTop: 1 }}>
                          {d.label} {members.length}명
                        </span>
                        <span style={{ fontSize: 12, color: C.dark, lineHeight: 1.6 }}>
                          {members.map(s => s.name || s.emp_no).join(", ")}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 추가수당 요약 */}
            {Object.keys(extraWork).filter(k => extraWork[k]?.typeId).length > 0 && (() => {
              const extraEntries = Object.entries(extraWork).filter(([, ex]) => ex?.typeId);
              const totalExtra = extraEntries.reduce((s, [, ex]) => s + (ex.amount || 0), 0);
              return (
                <div style={{ background: "#F5F3FF", borderRadius: 14, padding: "14px 16px", marginBottom: 12, border: "1.5px solid #DDD6FE" }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#6D28D9", marginBottom: 10 }}>💰 추가수당 ({extraEntries.length}건)</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {extraEntries.map(([empNo, ex]) => {
                      const staff = form.selectedStaff.find(s => s.emp_no === empNo);
                      return (
                        <div key={empNo} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontWeight: 700, color: C.dark }}>{staff?.name || empNo}</span>
                            <span style={{ color: "#8B5CF6", fontSize: 11 }}>
                              {ex.typeName}{ex.payKind === "hourly" && ex.start && ex.end ? ` (${ex.start}~${ex.end})` : ""}
                            </span>
                          </div>
                          <span style={{ fontWeight: 800, color: "#6D28D9", fontFamily: "monospace" }}>+{(ex.amount || 0).toLocaleString("ko-KR")}원</span>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ borderTop: "1px solid #DDD6FE", marginTop: 8, paddingTop: 8,
                    display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#6D28D9" }}>합계</span>
                    <span style={{ fontSize: 15, fontWeight: 900, color: "#6D28D9", fontFamily: "monospace" }}>+{totalExtra.toLocaleString("ko-KR")}원</span>
                  </div>
                </div>
              );
            })()}

            {/* 발렛비 요약 */}
            <div style={{ background: "#f5f6fa", borderRadius: 14, padding: "14px 16px", marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: C.navy, marginBottom: 10 }}>💰 발렛비 ({autoValetCount}건)</div>
              <div style={{ display: "grid", gap: 6 }}>
                {form.payList.filter(p => toNum(p.count) > 0 || toNum(p.amount) > 0).map(p => {
                  const pt = PAYMENT_TYPES.find(t => t.key === p.payment_type);
                  return (
                    <div key={p.payment_type} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                      <span style={{ color: C.gray }}>{pt?.icon} {pt?.label}{toNum(p.count) > 0 ? ` ${toNum(p.count)}건` : ""}</span>
                      <span style={{ fontWeight: 800, color: C.dark, fontFamily: "monospace" }}>{fmt(p.amount)}원</span>
                    </div>
                  );
                })}
                {form.payList.every(p => toNum(p.count) === 0 && toNum(p.amount) === 0) && (
                  <div style={{ fontSize: 12, color: C.gray }}>입력 없음</div>
                )}
              </div>
              <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 8, paddingTop: 8,
                display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>합계</span>
                <span style={{ fontSize: 15, fontWeight: 900, color: C.navy, fontFamily: "monospace" }}>{fmt(payTotal)}원</span>
              </div>
            </div>

            {/* 메모 */}
            {form.memo?.trim() && (
              <div style={{ background: "#f5f6fa", borderRadius: 14, padding: "12px 16px", marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: C.navy, marginBottom: 6 }}>📝 메모</div>
                <div style={{ fontSize: 13, color: C.dark, lineHeight: 1.5 }}>{form.memo}</div>
              </div>
            )}

            {/* 버튼 */}
            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <button onClick={() => setShowConfirm(false)} style={{
                flex: 1, padding: "14px", borderRadius: 14,
                border: `1.5px solid ${C.border}`, background: C.white,
                color: C.gray, fontSize: 15, fontWeight: 700, fontFamily: FONT,
              }}>
                취소
              </button>
              <button onClick={handleSubmit} style={{
                flex: 2, padding: "14px", borderRadius: 14, border: "none",
                background: `linear-gradient(135deg, ${C.navy}, #2a3eb1)`,
                color: C.white, fontSize: 15, fontWeight: 900, fontFamily: FONT,
                boxShadow: `0 4px 16px ${C.navy}40`,
              }}>
                ✅ 제출하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 하단 고정 제출 버튼 */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        padding: "12px 16px", paddingBottom: "max(12px, env(safe-area-inset-bottom))",
        background: C.white, boxShadow: "0 -4px 20px rgba(0,0,0,0.08)",
        borderTop: `1px solid ${C.border}`,
      }}>
        <button onClick={handleConfirmOpen} disabled={saving}
          style={{
            width: "100%", padding: "16px",
            background: saving ? C.border : `linear-gradient(135deg, ${C.navy}, ${C.navyLight})`,
            color: C.white, border: "none", borderRadius: 16,
            fontSize: 17, fontWeight: 900, fontFamily: FONT,
            boxShadow: saving ? "none" : `0 6px 24px ${C.navy}50`,
            transition: "all 0.2s",
          }}>
          {saving ? "저장 중..." : isEdit ? "✏️ 수정 완료" : "✅ 일보 제출"}
        </button>
      </div>
    </div>
  );
}

// ─── 홈 화면 ──────────────────────────────────────────────────────────────
function HomePage({ employee, onLogout, onNavigate }) {
  const today = getToday();
  const todayLabel = formatDateFull(today);
  const siteCode = employee?.site_code || "";

  const [todayReport, setTodayReport] = useState(null);
  const [todayPayments, setTodayPayments] = useState([]);
  const [recentReports, setRecentReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 오늘 일보 확인
      const { data: todayData } = await supabase
        .from("daily_reports").select("*")
        .eq("report_date", today).eq("site_code", siteCode)
        .maybeSingle();

      setTodayReport(todayData || null);

      if (todayData) {
        const { data: payData } = await supabase
          .from("daily_report_payment").select("*")
          .eq("report_id", todayData.id);
        setTodayPayments(payData || []);
      } else {
        setTodayPayments([]);
      }

      // 최근 7일 (오늘 제외)
      const d7 = new Date();
      d7.setDate(d7.getDate() - 7);
      const startDate = `${d7.getFullYear()}-${String(d7.getMonth() + 1).padStart(2, "0")}-${String(d7.getDate()).padStart(2, "0")}`;

      const { data: recentData } = await supabase
        .from("daily_reports").select("*")
        .eq("site_code", siteCode)
        .gte("report_date", startDate).lt("report_date", today)
        .order("report_date", { ascending: false }).limit(7);

      setRecentReports(recentData || []);
    } catch (e) {
      console.error("데이터 로드 실패:", e);
    } finally {
      setLoading(false);
    }
  }, [today, siteCode, refreshKey]);

  useEffect(() => { loadData(); }, [loadData]);

  const statusBadge = (status) => {
    const map = {
      submitted: { bg: "#e8f5e9", color: C.green, label: "제출 완료" },
      confirmed: { bg: "#e3f2fd", color: C.navy, label: "확정" },
      draft:     { bg: "#fff3e0", color: C.orange, label: "임시저장" },
    };
    const s = map[status] || map.submitted;
    return (
      <span style={{ padding: "3px 10px", borderRadius: 8, background: s.bg, color: s.color, fontSize: 11, fontWeight: 800 }}>
        {s.label}
      </span>
    );
  };

  return (
    <div style={{ minHeight: "100vh", background: C.lightGray, fontFamily: FONT }}>
      {/* 헤더 */}
      <div style={{ background: C.navy, color: C.white, padding: "env(safe-area-inset-top, 0) 0 0" }}>
        <div style={{ padding: "16px 20px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginBottom: 4 }}>🎫 미팍티켓 마감APP</div>
              <div style={{ fontSize: 20, fontWeight: 900 }}>{employee?.name || "크루"}님, 안녕하세요!</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", marginTop: 4 }}>
                {getSiteName(siteCode)} · {todayLabel}
              </div>
            </div>
            <button onClick={onLogout} style={{
              background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 10,
              color: "rgba(255,255,255,0.8)", padding: "8px 14px",
              fontSize: 13, fontWeight: 600, fontFamily: FONT,
            }}>로그아웃</button>
          </div>
        </div>
      </div>

      <div style={{ padding: "16px 16px 32px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "48px 0" }}>
            <Spinner size={36} color={C.navy} />
            <div style={{ color: C.gray, fontSize: 14, marginTop: 12 }}>로딩 중...</div>
          </div>
        ) : (
          <>
            {/* 오늘의 일보 상태 카드 */}
            <div style={{
              background: C.white, borderRadius: 24, padding: "24px 20px", marginBottom: 16,
              boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
              border: todayReport ? `2px solid ${C.green}30` : `2px solid ${C.gold}30`,
            }}>
              {todayReport ? (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <div style={{ fontSize: 16, fontWeight: 900, color: C.dark }}>📋 오늘의 일보</div>
                    {statusBadge(todayReport.status)}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
                    {[
                      { label: "근무인원", value: `${todayReport.staff_count || 0}명`, icon: "👥" },
                      { label: "발렛건수", value: `${todayReport.valet_count || 0}건`, icon: "🚗" },
                      { label: "발렛비", value: `${fmt(todayReport.valet_amount)}원`, icon: "💰" },
                    ].map(item => (
                      <div key={item.label} style={{ background: C.lightGray, borderRadius: 14, padding: "12px 8px", textAlign: "center" }}>
                        <div style={{ fontSize: 16, marginBottom: 4 }}>{item.icon}</div>
                        <div style={{ fontSize: 15, fontWeight: 900, color: C.navy }}>{item.value}</div>
                        <div style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>{item.label}</div>
                      </div>
                    ))}
                  </div>

                  {todayPayments.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                      {todayPayments.filter(p => toNum(p.amount) > 0).map(p => {
                        const pt = PAYMENT_TYPES.find(t => t.key === p.payment_type);
                        return (
                          <span key={p.payment_type} style={{
                            padding: "4px 10px", borderRadius: 8,
                            background: C.lightGray, fontSize: 12, fontWeight: 700, color: C.dark,
                          }}>
                            {pt?.icon} {pt?.label} {fmt(p.amount)}원
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {todayReport.images && todayReport.images.length > 0 && (
                    <div style={{ display: "flex", gap: 6, marginBottom: 14, overflowX: "auto" }}>
                      {todayReport.images.map((img, idx) => (
                        <img key={idx} src={img.url} alt="첨부"
                          style={{ width: 56, height: 56, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />
                      ))}
                      <span style={{ fontSize: 11, color: C.gray, alignSelf: "center", flexShrink: 0, marginLeft: 4 }}>
                        📷 {todayReport.images.length}장
                      </span>
                    </div>
                  )}

                  {todayReport.memo && (
                    <div style={{
                      padding: "10px 14px", background: "#fffde7", borderRadius: 12,
                      fontSize: 13, color: C.dark, marginBottom: 14, lineHeight: 1.5,
                    }}>
                      💬 {todayReport.memo}
                    </div>
                  )}

                  {todayReport.status !== "confirmed" ? (
                    <button onClick={() => onNavigate("form", { report: todayReport, payments: todayPayments })}
                      style={{
                        width: "100%", padding: "14px", background: C.white, color: C.navy,
                        border: `2px solid ${C.navy}`, borderRadius: 14,
                        fontSize: 15, fontWeight: 800, fontFamily: FONT,
                      }}>
                      ✏️ 수정하기
                    </button>
                  ) : (
                    <div style={{ padding: "10px", textAlign: "center", fontSize: 13, color: C.green, fontWeight: 700 }}>
                      ✅ 관리자에 의해 확정되었습니다
                    </div>
                  )}
                </>
              ) : (
                <div style={{ textAlign: "center", padding: "8px 0" }}>
                  <div style={{ fontSize: 52, marginBottom: 12 }}>📋</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: C.dark, marginBottom: 6 }}>오늘의 마감보고</div>
                  <div style={{ fontSize: 14, color: C.gray, marginBottom: 20, lineHeight: 1.6 }}>
                    아직 오늘 일보가 제출되지 않았습니다.
                  </div>
                  <button onClick={() => onNavigate("form")}
                    style={{
                      width: "100%", padding: "16px",
                      background: `linear-gradient(135deg, ${C.navy}, ${C.navyLight})`,
                      color: C.white, border: "none", borderRadius: 16,
                      fontSize: 17, fontWeight: 900, fontFamily: FONT,
                      boxShadow: `0 6px 24px ${C.navy}50`,
                    }}>
                    📝 일보 작성하기
                  </button>
                </div>
              )}
            </div>

            {/* 최근 일보 이력 */}
            <div style={{
              background: C.white, borderRadius: 24, padding: "20px", marginBottom: 16,
              boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
            }}>
              <div style={{ fontSize: 15, fontWeight: 900, color: C.dark, marginBottom: 14 }}>📊 최근 일보 이력</div>
              {recentReports.length === 0 ? (
                <div style={{ textAlign: "center", padding: "20px 0", color: C.gray, fontSize: 14 }}>
                  최근 7일간 제출된 일보가 없습니다.
                </div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {recentReports.map(r => (
                    <div key={r.id} style={{
                      padding: "14px 16px", background: C.lightGray, borderRadius: 14,
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                    }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: C.dark }}>{formatDate(r.report_date)}</div>
                        <div style={{ fontSize: 12, color: C.gray, marginTop: 3 }}>
                          👥{r.staff_count || 0}명 · 🚗{r.valet_count || 0}건 · 💰{fmt(r.valet_amount)}원
                        </div>
                      </div>
                      {statusBadge(r.status)}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 사번 정보 */}
            <div style={{
              padding: "14px 16px", background: C.white, borderRadius: 16,
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
              display: "flex", justifyContent: "center", gap: 20, fontSize: 13, color: C.gray,
            }}>
              <span><strong style={{ color: C.navy }}>사번</strong> {employee?.emp_id}</span>
              <span><strong style={{ color: C.navy }}>근무형태</strong> {employee?.work_type || "-"}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── 급여내역서 페이지 ──────────────────────────────────────────────────
function PayslipPage({ employee, onBack }) {
  const [slips, setSlips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSlip, setSelectedSlip] = useState(null);

  useEffect(() => {
    loadMyPayslips();
  }, []);

  async function loadMyPayslips() {
    setLoading(true);
    try {
      // employee.id 또는 emp_no로 조회
      let query = supabase.from("payslips").select("*").order("year", { ascending: false }).order("month", { ascending: false });
      if (employee?.id) {
        query = query.eq("employee_id", employee.id);
      } else if (employee?.emp_no) {
        query = query.eq("emp_no", employee.emp_no);
      }
      const { data } = await query;
      setSlips(data || []);
    } catch (_) { setSlips([]); }
    setLoading(false);
  }

  // 열람 시 is_read 업데이트
  async function handleViewSlip(slip) {
    setSelectedSlip(slip);
    if (!slip.is_read) {
      await supabase.from("payslips").update({ is_read: true, read_at: new Date().toISOString(), status: "read" }).eq("id", slip.id);
      setSlips(prev => prev.map(s => s.id === slip.id ? { ...s, is_read: true, read_at: new Date().toISOString() } : s));
    }
  }

  const fmtN = (n) => (n == null || isNaN(n)) ? "0" : Math.round(Number(n)).toLocaleString("ko-KR");

  // 상세 보기
  if (selectedSlip) {
    const s = selectedSlip;
    const payItems = [
      { label: "기본급", value: s.basic_pay },
      { label: "식대", value: s.meal },
      { label: "보육수당", value: s.childcare },
      { label: "자가운전", value: s.car_allow },
      { label: "팀장수당", value: s.team_allow },
      { label: "명절상여", value: s.holiday_bonus },
      { label: "인센티브", value: s.incentive },
      { label: "추가근무", value: s.extra_work },
      { label: "수기수당", value: s.manual_write },
      { label: "기타수당", value: s.extra1 },
    ].filter(item => item.value > 0);

    const dedItems = [
      { label: "국민연금", value: s.np },
      { label: "건강보험", value: s.hi },
      { label: "장기요양", value: s.lt },
      { label: "고용보험", value: s.ei },
      { label: "소득세", value: s.income_tax },
      { label: "지방소득세", value: s.local_tax },
      { label: "사고공제", value: s.accident_deduct },
      { label: "선지급", value: s.prepaid },
    ].filter(item => item.value > 0);

    return (
      <div style={{ minHeight: "100vh", background: C.lightGray, fontFamily: FONT }}>
        {/* 헤더 */}
        <div style={{ background: `linear-gradient(135deg, ${C.navy}, #1E3CB0)`, color: C.white, padding: "16px 20px", position: "sticky", top: 0, zIndex: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <button onClick={() => setSelectedSlip(null)} style={{ background: "none", border: "none", color: C.white, fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>← 목록</button>
            <div style={{ fontSize: 15, fontWeight: 900 }}>{s.year}년 {s.month}월 급여내역서</div>
            <div style={{ width: 40 }} />
          </div>
        </div>

        <div style={{ padding: "16px 16px 100px" }}>
          {/* 실수령액 카드 */}
          <div style={{ background: `linear-gradient(135deg, ${C.navy}, #1E3CB0)`, borderRadius: 16, padding: "24px 20px", marginBottom: 16, textAlign: "center", color: C.white }}>
            <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 8 }}>💰 실수령액</div>
            <div style={{ fontSize: 32, fontWeight: 900, fontFamily: "monospace" }}>{fmtN(s.net_pay)}<span style={{ fontSize: 16, fontWeight: 700 }}>원</span></div>
            <div style={{ marginTop: 12, display: "flex", justifyContent: "center", gap: 24, fontSize: 12, opacity: 0.8 }}>
              <span>지급: {fmtN(s.gross_pay)}원</span>
              <span>공제: {fmtN(s.total_deduct)}원</span>
            </div>
          </div>

          {/* 직원 정보 */}
          <div style={{ background: C.white, borderRadius: 12, padding: "14px 16px", marginBottom: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: C.gray }}>성명</span>
              <span style={{ fontWeight: 700 }}>{s.emp_name}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginTop: 8 }}>
              <span style={{ color: C.gray }}>사번</span>
              <span style={{ fontWeight: 700, color: C.navy }}>{s.emp_no}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginTop: 8 }}>
              <span style={{ color: C.gray }}>사업장</span>
              <span style={{ fontWeight: 700 }}>{getSiteName(s.site_code)}</span>
            </div>
          </div>

          {/* 지급 항목 */}
          <div style={{ background: C.white, borderRadius: 12, padding: "14px 16px", marginBottom: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <div style={{ fontSize: 14, fontWeight: 900, color: C.navy, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>💵 지급 항목</div>
            {payItems.map(item => (
              <div key={item.label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${C.lightGray}`, fontSize: 13 }}>
                <span style={{ color: C.gray }}>{item.label}</span>
                <span style={{ fontWeight: 700, fontFamily: "monospace" }}>{fmtN(item.value)}원</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0 0", fontSize: 14, fontWeight: 900 }}>
              <span style={{ color: C.navy }}>지급 합계</span>
              <span style={{ color: C.navy, fontFamily: "monospace" }}>{fmtN(s.gross_pay)}원</span>
            </div>
          </div>

          {/* 공제 항목 */}
          <div style={{ background: C.white, borderRadius: 12, padding: "14px 16px", marginBottom: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <div style={{ fontSize: 14, fontWeight: 900, color: C.red, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>📋 공제 항목 <span style={{ fontSize: 11, fontWeight: 600, color: C.gray }}>({s.tax_type})</span></div>
            {dedItems.length === 0 ? (
              <div style={{ textAlign: "center", padding: 16, color: C.gray, fontSize: 13 }}>공제 항목 없음</div>
            ) : dedItems.map(item => (
              <div key={item.label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${C.lightGray}`, fontSize: 13 }}>
                <span style={{ color: C.gray }}>{item.label}</span>
                <span style={{ fontWeight: 700, fontFamily: "monospace", color: C.red }}>-{fmtN(item.value)}원</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0 0", fontSize: 14, fontWeight: 900 }}>
              <span style={{ color: C.red }}>공제 합계</span>
              <span style={{ color: C.red, fontFamily: "monospace" }}>-{fmtN(s.total_deduct)}원</span>
            </div>
          </div>

          {/* 계좌 정보 */}
          {s.bank_name && (
            <div style={{ background: C.white, borderRadius: 12, padding: "14px 16px", marginBottom: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
              <div style={{ fontSize: 14, fontWeight: 900, color: C.navy, marginBottom: 12 }}>🏦 입금 계좌</div>
              <div style={{ fontSize: 13, color: C.gray }}>
                {s.bank_name} {s.account_no} ({s.account_holder})
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 목록 화면
  return (
    <div style={{ minHeight: "100vh", background: C.lightGray, fontFamily: FONT }}>
      {/* 헤더 */}
      <div style={{ background: `linear-gradient(135deg, ${C.navy}, #1E3CB0)`, color: C.white, padding: "16px 20px" }}>
        <div style={{ fontSize: 18, fontWeight: 900 }}>💰 급여내역서</div>
        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>{employee?.name}님의 급여내역</div>
      </div>

      <div style={{ padding: "16px 16px 100px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: C.gray }}>로딩 중...</div>
        ) : slips.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, color: C.gray, fontSize: 14 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>💰</div>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>급여내역서가 없습니다</div>
            <div style={{ fontSize: 12 }}>급여가 확정되면 이곳에 표시됩니다.</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {slips.map(s => (
              <button key={s.id} onClick={() => handleViewSlip(s)}
                style={{ display: "block", width: "100%", background: C.white, borderRadius: 14, padding: "16px 18px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.04)", border: s.is_read ? `1px solid ${C.border}` : `2px solid ${C.gold}`,
                  cursor: "pointer", textAlign: "left", fontFamily: FONT, position: "relative" }}>
                {!s.is_read && (
                  <div style={{ position: "absolute", top: 10, right: 12, width: 10, height: 10, borderRadius: 5, background: C.red }} />
                )}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ fontSize: 15, fontWeight: 900, color: C.dark }}>{s.year}년 {s.month}월</div>
                  <div style={{ fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
                    background: s.is_read ? "#D4EDDA" : "#FFF3CD", color: s.is_read ? "#155724" : "#856404" }}>
                    {s.is_read ? "✅ 확인" : "🆕 새 내역서"}
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                  <div>
                    <div style={{ fontSize: 11, color: C.gray, marginBottom: 4 }}>{getSiteName(s.site_code)}</div>
                    <div style={{ fontSize: 11, color: C.gray }}>지급 {fmtN(s.gross_pay)}원 · 공제 {fmtN(s.total_deduct)}원</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 11, color: C.gray, marginBottom: 2 }}>실수령액</div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: C.navy, fontFamily: "monospace" }}>{fmtN(s.net_pay)}<span style={{ fontSize: 12, fontWeight: 700 }}>원</span></div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 앱 루트 ──────────────────────────────────────────────────────────────
// ── 오류 보고 FAB v2 (현장앱 — 미팍티켓 동일) ──────────
const FIELD_BUG_CATEGORIES = [
  { key: "ui",          label: "🖥️ UI 깨짐" },
  { key: "feature",     label: "⚙️ 기능 오류" },
  { key: "data",        label: "📊 데이터 이상" },
  { key: "performance", label: "🐌 느림/멈춤" },
  { key: "suggestion",  label: "💡 기타" },
];
const FIELD_BUG_PRIORITY = {
  low:      { label: "낮음", color: "#666",    bg: "#f3f4f6" },
  medium:   { label: "보통", color: "#EA580C", bg: "#fff7ed" },
  high:     { label: "높음", color: "#DC2626", bg: "#fef2f2" },
  critical: { label: "긴급", color: "#7C3AED", bg: "#f5f3ff" },
};
const FIELD_PAGE_LABELS = { home: "홈/일보목록", form: "일보 작성", payslip: "급여내역서" };

async function fieldFileToBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

async function fieldAiClassifyBug(title, description) {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 200,
        messages: [{
          role: "user",
          content: `다음 오류 보고를 분석해서 JSON으로만 응답하세요:\n제목: ${title}\n내용: ${description}\n\n응답형식:\n{"category": "ui|feature|data|performance|suggestion", "priority": "low|medium|high|critical", "summary": "한줄요약(30자이내)"}`
        }]
      })
    });
    const data = await res.json();
    const text = data.content?.[0]?.text || "";
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch { return null; }
}

function FieldBugReportFAB({ currentPage, employee }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", category: "", description: "", priority: "medium", repro: "", screenshots: [] });
  const [aiResult, setAiResult] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = async (e) => {
      const items = Array.from(e.clipboardData?.items || []);
      const imgItem = items.find(i => i.type.startsWith("image/"));
      if (!imgItem) return;
      e.preventDefault();
      if (form.screenshots.length >= 3) return;
      const file = imgItem.getAsFile();
      if (file) { const b64 = await fieldFileToBase64(file); setForm(f => ({ ...f, screenshots: [...f.screenshots, b64] })); }
    };
    window.addEventListener("paste", handler);
    return () => window.removeEventListener("paste", handler);
  }, [open, form.screenshots]);

  const addScreenshots = async (files) => {
    const remaining = 3 - form.screenshots.length;
    const toAdd = Array.from(files).slice(0, remaining);
    const b64s = await Promise.all(toAdd.map(fieldFileToBase64));
    setForm(f => ({ ...f, screenshots: [...f.screenshots, ...b64s] }));
  };
  const removeShot = (i) => setForm(f => ({ ...f, screenshots: f.screenshots.filter((_, j) => j !== i) }));

  const runAI = async () => {
    if (!form.title || !form.description) return;
    setAiLoading(true);
    const result = await fieldAiClassifyBug(form.title, form.description);
    if (result) {
      setAiResult(result);
      setForm(f => ({ ...f, category: f.category || result.category, priority: result.priority || f.priority }));
    }
    setAiLoading(false);
  };

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.description.trim()) { alert("제목과 내용을 입력해주세요."); return; }
    setLoading(true);
    try {
      const { error } = await supabase.from("bug_reports").insert({
        app: "field",
        reporter_name: employee?.name || "알 수 없음",
        reporter_emp_no: employee?.emp_no || employee?.emp_id || "",
        reporter_role: employee?.role || "field_member",
        page: currentPage || "",
        page_label: FIELD_PAGE_LABELS[currentPage] || currentPage || "",
        category: form.category || "suggestion",
        title: form.title.trim(),
        description: form.description.trim(),
        repro_steps: form.repro.trim(),
        priority: form.priority,
        status: "open",
        screenshots: form.screenshots,
        ai_summary: aiResult?.summary || null,
      });
      if (error) throw error;
      setDone(true);
      setTimeout(() => {
        setOpen(false); setDone(false); setAiResult(null);
        setForm({ title: "", category: "", description: "", priority: "medium", repro: "", screenshots: [] });
      }, 1800);
    } catch (e) { alert("제출 실패: " + e.message); }
    finally { setLoading(false); }
  };

  const pageLabel = FIELD_PAGE_LABELS[currentPage] || currentPage || "홈";

  return (
    <>
      <button onClick={() => setOpen(true)} title="오류 제보" style={{
        position: "fixed", bottom: 76, right: 16, zIndex: 200,
        width: 44, height: 44, borderRadius: "50%",
        background: C.navy, border: `2.5px solid ${C.gold}`,
        color: "#fff", fontSize: 18, cursor: "pointer",
        boxShadow: "0 3px 12px rgba(20,40,160,0.35)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>🐛</button>

      {open && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 480, boxShadow: "0 -4px 24px rgba(0,0,0,0.18)", maxHeight: "92vh", display: "flex", flexDirection: "column" }}>
            {/* 핸들 */}
            <div style={{ width: 40, height: 4, borderRadius: 2, background: "#DDD", margin: "12px auto 0", flexShrink: 0 }} />
            {/* 헤더 */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 18px 10px", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: 7, background: "#fff", border: "2px solid #1A1D2B", position: "relative", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 7, background: C.gold }} />
                  <span style={{ fontWeight: 900, fontSize: 14, color: "#1A1D2B", position: "relative", zIndex: 1, marginTop: -2 }}>P</span>
                </div>
                <span style={{ fontWeight: 900, fontSize: 14, color: "#1A1D2B", fontFamily: FONT }}>미팍<span style={{ color: C.gold }}>Ticket</span></span>
                <span style={{ fontSize: 11, background: "#fee2e2", color: "#DC2626", fontWeight: 700, padding: "2px 8px", borderRadius: 20 }}>🐛 오류 제보</span>
              </div>
              <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#999", padding: 0 }}>×</button>
            </div>

            {/* 스크롤 영역 */}
            <div style={{ overflowY: "auto", flex: 1, padding: "0 18px" }}>
              {done ? (
                <div style={{ textAlign: "center", padding: "48px 0" }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
                  <div style={{ fontWeight: 900, fontSize: 18, color: C.navy, fontFamily: FONT }}>접수 완료!</div>
                  <div style={{ color: "#666", fontSize: 13, marginTop: 8 }}>빠르게 확인하겠습니다.</div>
                </div>
              ) : (
                <>
                  {aiResult && (
                    <div style={{ background: "#f0f4ff", border: `1px solid ${C.navy}22`, borderRadius: 10, padding: "8px 12px", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                      <span>🤖</span>
                      <div style={{ flex: 1, fontSize: 12, color: "#444", fontFamily: FONT }}>
                        <strong style={{ color: C.navy }}>AI 제안:</strong> {FIELD_BUG_CATEGORIES.find(c => c.key === aiResult.category)?.label} · {FIELD_BUG_PRIORITY[aiResult.priority]?.label}
                        {aiResult.summary && <span style={{ color: "#666" }}> · {aiResult.summary}</span>}
                      </div>
                    </div>
                  )}

                  {/* 제목 */}
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#333", marginBottom: 6, fontFamily: FONT }}>제목 <span style={{ color: "#DC2626" }}>*</span></div>
                    <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} onBlur={runAI} placeholder="어떤 문제가 발생했나요?" style={{ width: "100%", padding: "10px 14px", border: "1.5px solid #DDD", borderRadius: 10, fontSize: 14, fontFamily: FONT, boxSizing: "border-box", outline: "none" }} />
                  </div>

                  {/* 카테고리 */}
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#333", marginBottom: 8, fontFamily: FONT }}>카테고리 <span style={{ color: "#DC2626" }}>*</span></div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {FIELD_BUG_CATEGORIES.map(c => (
                        <button key={c.key} onClick={() => setForm(f => ({ ...f, category: c.key }))} style={{
                          padding: "7px 13px", borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: FONT,
                          border: `1.5px solid ${form.category === c.key ? C.navy : "#DDD"}`,
                          background: form.category === c.key ? "#EEF2FF" : "#fff",
                          color: form.category === c.key ? C.navy : "#666",
                        }}>{c.label}</button>
                      ))}
                    </div>
                  </div>

                  {/* 심각도 */}
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#333", marginBottom: 6, fontFamily: FONT }}>심각도</div>
                    <div style={{ display: "flex", gap: 6 }}>
                      {Object.entries(FIELD_BUG_PRIORITY).map(([k, v]) => (
                        <button key={k} onClick={() => setForm(f => ({ ...f, priority: k }))} style={{
                          flex: 1, padding: "8px 0", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: FONT,
                          border: `1.5px solid ${form.priority === k ? v.color : "#DDD"}`,
                          background: form.priority === k ? v.bg : "#fff",
                          color: form.priority === k ? v.color : "#999",
                        }}>{v.label}</button>
                      ))}
                    </div>
                  </div>

                  {/* 발생 페이지 (자동) */}
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#333", marginBottom: 6, fontFamily: FONT }}>발생 페이지</div>
                    <div style={{ padding: "10px 14px", border: "1.5px solid #DDD", borderRadius: 10, fontSize: 13, fontFamily: FONT, background: "#f9f9f9", color: "#555" }}>{pageLabel}</div>
                  </div>

                  {/* 상세 설명 */}
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#333", marginBottom: 6, fontFamily: FONT }}>상세 설명 <span style={{ color: "#DC2626" }}>*</span></div>
                    <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} onBlur={runAI} placeholder="어떤 상황에서 발생했는지 자세히 적어주세요..." rows={3} style={{ width: "100%", padding: "10px 14px", border: "1.5px solid #DDD", borderRadius: 10, fontSize: 13, fontFamily: FONT, resize: "none", boxSizing: "border-box", outline: "none" }} />
                    {aiLoading && <div style={{ fontSize: 11, color: C.navy, marginTop: 4 }}>🤖 AI가 분류 중...</div>}
                  </div>

                  {/* 재현 방법 */}
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#333", marginBottom: 6, fontFamily: FONT }}>재현 방법 <span style={{ color: "#999", fontWeight: 400 }}>(선택)</span></div>
                    <textarea value={form.repro} onChange={e => setForm(f => ({ ...f, repro: e.target.value }))} placeholder={"1. 일보 제출 클릭 2. 사진 첨부 시 오류"} rows={2} style={{ width: "100%", padding: "10px 14px", border: "1.5px solid #DDD", borderRadius: 10, fontSize: 13, fontFamily: FONT, resize: "none", boxSizing: "border-box", outline: "none" }} />
                  </div>

                  {/* 스크린샷 */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#333", marginBottom: 8, fontFamily: FONT }}>스크린샷 <span style={{ color: "#999", fontWeight: 400 }}>(선택, 최대 3장)</span></div>
                    <input ref={fileInputRef} type="file" accept="image/*" multiple capture="environment" style={{ display: "none" }} onChange={async e => { await addScreenshots(e.target.files); e.target.value = ""; }} />
                    {form.screenshots.length < 3 && (
                      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                        <button onClick={() => { if (fileInputRef.current) { fileInputRef.current.removeAttribute("capture"); fileInputRef.current.click(); } }} style={{ flex: 1, padding: "9px 0", borderRadius: 10, border: "1.5px dashed #CCC", background: "#FAFAFA", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: FONT, color: "#555" }}>🖼 갤러리</button>
                        <button onClick={() => { if (fileInputRef.current) { fileInputRef.current.setAttribute("capture", "environment"); fileInputRef.current.click(); } }} style={{ flex: 1, padding: "9px 0", borderRadius: 10, border: "1.5px dashed #CCC", background: "#FAFAFA", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: FONT, color: "#555" }}>📷 촬영</button>
                        <button onClick={async () => {
                          try {
                            const items = await navigator.clipboard.read();
                            for (const item of items) {
                              const t = item.types.find(x => x.startsWith("image/"));
                              if (t) { const blob = await item.getType(t); await addScreenshots([new File([blob], "paste.png", { type: t })]); }
                            }
                          } catch { alert("Ctrl+V로 이미지를 붙여넣을 수도 있습니다."); }
                        }} style={{ flex: 1, padding: "9px 0", borderRadius: 10, border: "1.5px dashed #CCC", background: "#FAFAFA", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: FONT, color: "#555" }}>📋 붙여넣기</button>
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: "#999", marginBottom: form.screenshots.length > 0 ? 8 : 0 }}>Ctrl+V로 스크린샷을 붙여넣을 수 있습니다</div>
                    {form.screenshots.length > 0 && (
                      <div style={{ display: "flex", gap: 8 }}>
                        {form.screenshots.map((s, i) => (
                          <div key={i} style={{ position: "relative", width: 72, height: 72 }}>
                            <img src={s} alt="" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8, border: "1px solid #DDD" }} />
                            <button onClick={() => removeShot(i)} style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%", background: "#DC2626", border: "none", color: "#fff", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>×</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* 제출 버튼 — 고정 하단 */}
            {!done && (
              <div style={{ padding: "12px 18px", paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))", borderTop: "1px solid #eee", flexShrink: 0 }}>
                <button onClick={handleSubmit} disabled={loading} style={{
                  width: "100%", padding: "14px 0", borderRadius: 12, border: "none",
                  background: loading ? "#999" : "#DC2626",
                  color: "#fff", fontSize: 15, fontWeight: 800, cursor: loading ? "not-allowed" : "pointer", fontFamily: FONT,
                }}>
                  {loading ? "제출 중..." : "🐛 오류 제보 전송"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default function App() {
  const [authState, setAuthState] = useState("loading");
  const [employee, setEmployee] = useState(null);
  const [page, setPage] = useState("home");
  const [pageData, setPageData] = useState(null);
  const [toast, setToast] = useState(null);
  const [unreadPayslips, setUnreadPayslips] = useState(0);

  // 사업장명 DB 로드 (site_details.site_name 컬럼 — 없으면 기본값 유지)
  useEffect(() => {
    async function loadSiteNames() {
      try {
        const { data } = await supabase
          .from("site_details")
          .select("site_code, site_name")
          .not("site_name", "is", null);
        if (data && data.length > 0) {
          const map = {};
          data.forEach(r => { if (r.site_name) map[r.site_code] = r.site_name; });
          updateSiteNamesCache(map);
        }
      } catch (_) { /* site_name 컬럼 없으면 기본값 유지 */ }
    }
    loadSiteNames();
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) loadEmployee(session.user.id);
      else setAuthState("login");
    });
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
      // ① employees 테이블 시도 (기존 field_member)
      const { data, error } = await supabase
        .from("employees")
        .select("id, name, emp_no, site_code_1, work_type, status")
        .eq("auth_user_id", authUserId)
        .single();
      if (!error && data) {
        setEmployee({ ...data, emp_id: data.emp_no, site_code: data.site_code_1 });
        setAuthState("home");
        return;
      }
      // ② profiles 테이블 fallback (crew 계정)
      const { data: prof, error: profErr } = await supabase
        .from("profiles")
        .select("name, emp_no, site_code, role")
        .eq("id", authUserId)
        .single();
      if (!profErr && prof && (prof.role === "crew" || prof.role === "admin" || prof.role === "super_admin")) {
        setEmployee({ name: prof.name, emp_no: prof.emp_no, emp_id: prof.emp_no, site_code: prof.site_code, role: prof.role });
        setAuthState("home");
        return;
      }
      throw new Error("직원 정보를 찾을 수 없습니다.");
    } catch (e) {
      console.error("직원 정보 로드 실패:", e);
      await supabase.auth.signOut();
      setAuthState("login");
    }
  }

  function handleLogin({ session, employee: emp }) {
    setEmployee(emp);
    setAuthState("home");
    setPage("home");
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setEmployee(null);
    setAuthState("login");
    setPage("home");
    setPageData(null);
  }

  function handleNavigate(target, data = null) {
    setPage(target);
    setPageData(data);
  }

  function handleReportSaved() {
    setToast({ message: "일보가 성공적으로 제출되었습니다!", type: "success" });
    setPage("home");
    setPageData(null);
  }

  // 미확인 급여내역서 수 로딩
  const loadUnreadPayslips = useCallback(async () => {
    if (!employee?.id && !employee?.emp_no) return;
    try {
      let query = supabase.from("payslips").select("id", { count: "exact", head: true }).eq("is_read", false);
      if (employee?.id) query = query.eq("employee_id", employee.id);
      else if (employee?.emp_no) query = query.eq("emp_no", employee.emp_no);
      const { count } = await query;
      setUnreadPayslips(count || 0);
    } catch (_) {}
  }, [employee]);

  useEffect(() => {
    if (authState === "home") loadUnreadPayslips();
  }, [authState, loadUnreadPayslips, page]);

  if (authState === "loading") {
    return (
      <div style={{
        minHeight: "100vh",
        background: `linear-gradient(160deg, ${C.navy} 0%, #050d3d 100%)`,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 20,
        fontFamily: FONT,
      }}>
        <div style={{ fontSize: 48 }}>🎫</div>
        <Spinner size={40} color={C.gold} />
        <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>로딩 중...</div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (authState === "login") return <LoginPage onLogin={handleLogin} />;

  return (
    <div style={{ fontFamily: FONT }}>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      {page === "form" ? (
        <ReportFormPage
          employee={employee}
          editReport={pageData?.report || null}
          editPayments={pageData?.payments || []}
          onSave={handleReportSaved}
          onBack={() => { setPage("home"); setPageData(null); }}
        />
      ) : page === "payslip" ? (
        <PayslipPage employee={employee} onBack={() => setPage("home")} />
      ) : (
        <HomePage employee={employee} onLogout={handleLogout} onNavigate={handleNavigate} />
      )}

      {/* ── 하단 탭 바 ── */}
      {page !== "form" && (
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0, background: C.white,
          borderTop: `1px solid ${C.border}`, display: "flex", zIndex: 100,
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          boxShadow: "0 -2px 12px rgba(0,0,0,0.06)",
        }}>
          {[
            { key: "home", icon: "🏠", label: "홈", badge: 0 },
            { key: "payslip", icon: "💰", label: "급여", badge: unreadPayslips },
          ].map(tab => (
            <button key={tab.key} onClick={() => { setPage(tab.key); setPageData(null); }}
              style={{
                flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
                justifyContent: "center", padding: "10px 0 8px", border: "none", cursor: "pointer",
                background: "transparent", fontFamily: FONT, position: "relative",
                color: page === tab.key ? C.navy : C.gray,
              }}>
              <div style={{ fontSize: 20, marginBottom: 2, position: "relative" }}>
                {tab.icon}
                {tab.badge > 0 && (
                  <div style={{
                    position: "absolute", top: -4, right: -10, minWidth: 18, height: 18,
                    borderRadius: 9, background: C.red, color: C.white,
                    fontSize: 10, fontWeight: 900, display: "flex", alignItems: "center",
                    justifyContent: "center", padding: "0 4px",
                  }}>{tab.badge}</div>
                )}
              </div>
              <div style={{ fontSize: 10, fontWeight: page === tab.key ? 900 : 600 }}>{tab.label}</div>
              {page === tab.key && (
                <div style={{ position: "absolute", top: 0, left: "30%", right: "30%", height: 3, borderRadius: 2, background: C.navy }} />
              )}
            </button>
          ))}
        </div>
      )}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideDown {
          from { transform: translate(-50%, -20px); opacity: 0; }
          to   { transform: translate(-50%, 0); opacity: 1; }
        }
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: ${FONT}; -webkit-font-smoothing: antialiased; }
        input, textarea, button, select { font-family: ${FONT}; }
        input:focus, textarea:focus { outline: none; }
        button { cursor: pointer; }
      `}</style>

      {/* 오류보고 FAB — 로그인 후 항상 표시 */}
      <FieldBugReportFAB currentPage={page} employee={employee} />
    </div>
  );
}
