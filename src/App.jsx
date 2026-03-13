import { useState, useEffect, useCallback, useMemo } from "react";
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
const FONT = "'Noto Sans KR', -apple-system, BlinkMacSystemFont, sans-serif";

const DUTY_TYPES = [
  { key: "site",    label: "해당매장",  color: "#1428A0", bg: "#eef0ff" },
  { key: "hq",      label: "본사지원",  color: "#E97132", bg: "#fff4ec" },
  { key: "part",    label: "알바지원",  color: "#43A047", bg: "#edf7ee" },
  { key: "extra",   label: "추가근무",  color: "#8B5CF6", bg: "#f3f0ff" },
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
  const [step, setStep] = useState("empId");
  const [empId, setEmpId] = useState(() => localStorage.getItem(STORAGE_EMP_ID_KEY) || "");
  const [pin, setPin]     = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState("");
  const [empName, setEmpName] = useState("");

  async function handleEmpIdNext() {
    if (!empId.trim()) { setError("사번을 입력해주세요."); return; }
    const id = empId.trim().toUpperCase();
    // 사번 형식 체크만 (MP숫자 or MPA숫자)
    if (!/^MP[A-Z]?\d+$/.test(id)) {
      setError("사번 형식이 올바르지 않습니다. (예: MP24101)");
      return;
    }
    localStorage.setItem(STORAGE_EMP_ID_KEY, id);
    setEmpName(id);   // PIN 화면에 사번 표시
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
      // ① Supabase Auth 직접 로그인 (crew 계정: 사번@mepark.internal + 전화번호뒷4자리)
      const email = `${id.toLowerCase()}@mepark.internal`;
      const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({ email, password: pinValue });

      if (!authErr && authData?.user) {
        // profiles에서 사업장/이름 읽기
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

      // ② fallback: 기존 field_login Edge Function (field_member)
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
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <div style={{
          width: 80, height: 80, borderRadius: 24, background: C.gold,
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 16px", boxShadow: `0 8px 32px ${C.gold}40`,
        }}>
          <span style={{ fontSize: 36, fontWeight: 900, color: C.navy }}>🎫</span>
        </div>
        <div style={{ color: C.white, fontSize: 26, fontWeight: 900, letterSpacing: "-0.5px" }}>미팍티켓</div>
        <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 13, marginTop: 4 }}>현장크루 마감보고 앱 {APP_VERSION}</div>
      </div>

      <div style={{
        width: "100%", maxWidth: 380, background: C.white,
        borderRadius: 24, padding: "28px 24px 32px",
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
      }}>
        {step === "empId" && (
          <>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: C.dark, marginBottom: 6 }}>사번 입력</div>
              <div style={{ fontSize: 13, color: C.gray }}>사번을 입력해주세요</div>
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
                  outline: "none", letterSpacing: 1, transition: "border-color 0.2s",
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
                style={{ background: "none", border: "none", color: C.gray, fontSize: 13, fontWeight: 600, marginBottom: 12, padding: 0, fontFamily: FONT }}>
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
      </div>
      <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, marginTop: 24, textAlign: "center" }}>PIN을 모를 경우 관리자에게 문의하세요</div>
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
      const staffRows = (form.selectedStaff || []).map(s => ({
        report_id: reportId,
        employee_id: s.employee_id || null,
        name_raw: s.duty === "part" ? s.name : null,
        staff_type: s.duty || "site",
        work_hours: 0,
      }));
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

// ─── 앱 루트 ──────────────────────────────────────────────────────────────
export default function App() {
  const [authState, setAuthState] = useState("loading");
  const [employee, setEmployee] = useState(null);
  const [page, setPage] = useState("home");
  const [pageData, setPageData] = useState(null);
  const [toast, setToast] = useState(null);

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
      ) : (
        <HomePage employee={employee} onLogout={handleLogout} onNavigate={handleNavigate} />
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
    </div>
  );
}
