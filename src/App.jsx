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

const PAYMENT_TYPES = [
  { key: "cash",     label: "현금",     icon: "💵" },
  { key: "card",     label: "카드",     icon: "💳" },
  { key: "transfer", label: "계좌이체", icon: "🏦" },
  { key: "etc",      label: "기타",     icon: "📋" },
];

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
    setError("");
    setLoading(true);
    try {
      // RPC로 사번 확인 (RLS 우회 — SECURITY DEFINER)
      const { data, error: dbErr } = await supabase
        .rpc("check_field_employee", { p_emp_no: empId.trim().toUpperCase() });
      if (dbErr || !data || !data.name) { setError("등록되지 않은 사번입니다. 관리자에게 문의하세요."); return; }
      if (data.status !== "active") { setError("재직 중인 직원이 아닙니다. 관리자에게 문의하세요."); return; }
      localStorage.setItem(STORAGE_EMP_ID_KEY, empId.trim().toUpperCase());
      setEmpName(data.name);
      setStep("pin");
    } catch (e) {
      setError(e.message || "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
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
    try {
      const result = await callAdminApi({ action: "field_login", emp_id: empId.trim().toUpperCase(), pin: pinValue });
      if (result.error) throw new Error(result.error);
      if (!result.access_token) throw new Error("로그인 처리 실패");
      const { data: sessionData, error: sessionErr } = await supabase.auth.setSession({
        access_token: result.access_token, refresh_token: result.refresh_token,
      });
      if (sessionErr) throw sessionErr;
      onLogin({ session: sessionData.session, employee: result.employee });
    } catch (e) {
      setError(e.message || "PIN이 올바르지 않습니다.");
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

  const [form, setForm] = useState(() => {
    if (editReport) {
      return {
        valet_count: editReport.valet_count || 0,
        valet_amount: editReport.valet_amount || 0,
        staff_count: editReport.staff_count || 0,
        memo: editReport.memo || "",
        images: editReport.images || [],
        payList: PAYMENT_TYPES.map(pt => {
          const existing = (editPayments || []).find(p => p.payment_type === pt.key);
          return { payment_type: pt.key, count: existing?.count || 0, amount: existing?.amount || 0 };
        }),
      };
    }
    return {
      valet_count: 0, valet_amount: 0, staff_count: 0, memo: "", images: [],
      payList: PAYMENT_TYPES.map(pt => ({ payment_type: pt.key, count: 0, amount: 0 })),
    };
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);

  const payTotal = useMemo(() => form.payList.reduce((s, p) => s + toNum(p.amount), 0), [form.payList]);

  function updatePay(idx, field, val) {
    setForm(f => ({ ...f, payList: f.payList.map((p, i) => i === idx ? { ...p, [field]: val } : p) }));
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

  function removeImage(idx) {
    setForm(f => ({ ...f, images: f.images.filter((_, i) => i !== idx) }));
  }

  async function handleSubmit() {
    if (toNum(form.valet_count) <= 0 && toNum(form.valet_amount) <= 0 && payTotal <= 0 && !form.memo?.trim()) {
      setError("최소 1개 이상의 항목을 입력해주세요.");
      return;
    }
    const valetAmt = toNum(form.valet_amount);
    if (payTotal > 0 && valetAmt > 0 && Math.abs(payTotal - valetAmt) > 100) {
      if (!window.confirm(`결제수단 합계(${fmt(payTotal)}원)와 발렛비(${fmt(valetAmt)}원)가 일치하지 않습니다.\n그래도 저장하시겠습니까?`)) return;
    }
    setSaving(true);
    setError("");
    try {
      let reportId = editReport?.id;
      const reportPayload = {
        report_date: today,
        site_code: siteCode,
        valet_count: toNum(form.valet_count),
        valet_amount: toNum(form.valet_amount),
        staff_count: toNum(form.staff_count),
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
      onSave();
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
        {/* 기본 정보 */}
        <div style={sectionStyle}>
          {sectionTitle("📍", "기본 정보")}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>사업장</label>
              <div style={{ padding: "12px 14px", background: "#e8ebf5", borderRadius: 12, fontSize: 14, fontWeight: 700, color: C.navy }}>
                {getSiteName(siteCode)}
              </div>
            </div>
            <div>
              <label style={labelStyle}>보고일</label>
              <div style={{ padding: "12px 14px", background: "#e8ebf5", borderRadius: 12, fontSize: 14, fontWeight: 700, color: C.navy }}>
                {formatDate(today)}
              </div>
            </div>
          </div>
        </div>

        {/* 근무 현황 */}
        <div style={sectionStyle}>
          {sectionTitle("👥", "근무 현황")}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>근무 인원 (명)</label>
              <NumInput value={form.staff_count} onChange={v => setForm(f => ({ ...f, staff_count: v }))} suffix="명" />
            </div>
            <div>
              <label style={labelStyle}>발렛 처리 (건)</label>
              <NumInput value={form.valet_count} onChange={v => setForm(f => ({ ...f, valet_count: v }))} suffix="건" />
            </div>
          </div>
        </div>

        {/* 발렛비 */}
        <div style={sectionStyle}>
          {sectionTitle("💰", "발렛비")}
          <label style={labelStyle}>오늘 발렛비 총액</label>
          <NumInput value={form.valet_amount} onChange={v => setForm(f => ({ ...f, valet_amount: v }))} suffix="원" />
          {toNum(form.valet_count) > 0 && toNum(form.valet_amount) > 0 && (
            <div style={{ marginTop: 8, fontSize: 12, color: C.gray, textAlign: "right" }}>
              건당 평균 <strong style={{ color: C.navy }}>{fmt(Math.round(toNum(form.valet_amount) / toNum(form.valet_count)))}</strong>원
            </div>
          )}
        </div>

        {/* 결제 수단 */}
        <div style={sectionStyle}>
          {sectionTitle("💳", "결제 수단별 매출")}
          <div style={{ display: "grid", gap: 12 }}>
            {form.payList.map((p, idx) => {
              const pt = PAYMENT_TYPES.find(t => t.key === p.payment_type);
              return (
                <div key={p.payment_type} style={{
                  border: `1.5px solid ${toNum(p.amount) > 0 ? C.navy + "40" : C.border}`,
                  borderRadius: 14, padding: "14px",
                  background: toNum(p.amount) > 0 ? "#f0f2ff" : C.white,
                  transition: "all 0.2s",
                }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: C.dark, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                    {pt?.icon} {pt?.label}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1.8fr", gap: 8 }}>
                    <div>
                      <label style={{ ...labelStyle, fontSize: 11 }}>건수</label>
                      <NumInput value={p.count} onChange={v => updatePay(idx, "count", v)} suffix="건" />
                    </div>
                    <div>
                      <label style={{ ...labelStyle, fontSize: 11 }}>금액</label>
                      <NumInput value={p.amount} onChange={v => updatePay(idx, "amount", v)} suffix="원" />
                    </div>
                  </div>
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
          {payTotal > 0 && toNum(form.valet_amount) > 0 && Math.abs(payTotal - toNum(form.valet_amount)) > 100 && (
            <div style={{
              marginTop: 10, padding: "10px 14px", background: "#fff7ed",
              border: `1.5px solid ${C.orange}40`, borderRadius: 12,
              fontSize: 12, color: C.orange, fontWeight: 700,
            }}>
              ⚠️ 결제 합계({fmt(payTotal)}원)와 발렛비({fmt(form.valet_amount)}원)가 일치하지 않습니다.
            </div>
          )}
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

      {/* 하단 고정 제출 버튼 */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        padding: "12px 16px", paddingBottom: "max(12px, env(safe-area-inset-bottom))",
        background: C.white, boxShadow: "0 -4px 20px rgba(0,0,0,0.08)",
        borderTop: `1px solid ${C.border}`,
      }}>
        <button onClick={handleSubmit} disabled={saving}
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
      const { data, error } = await supabase
        .from("employees")
        .select("id, name, emp_no, site_code_1, work_type, status")
        .eq("auth_user_id", authUserId)
        .single();
      if (error || !data) throw new Error("직원 정보를 찾을 수 없습니다.");
      // DB 컬럼명 → 앱 내부 통일명으로 매핑
      setEmployee({ ...data, emp_id: data.emp_no, site_code: data.site_code_1 });
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
