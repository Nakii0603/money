"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { EXPENSE_REASONS, INCOME_REASONS } from "@/lib/reasons";

type TxType = "income" | "expense";
type Status = "idle" | "loading" | "ok" | "error";

const OPS = ["+", "−", "×", "÷"];

// Current local time as YYYY-MM-DDTHH:mm for <input type="datetime-local">
function nowLocalStr() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Evaluates "12+3×4" style expressions with operator precedence, no eval()
function evaluate(expr: string): number | null {
  const tokens = expr.match(/\d+\.?\d*|\.\d+|[+−×÷]/g);
  if (!tokens || tokens.length === 0) return null;
  if (OPS.includes(tokens[tokens.length - 1])) tokens.pop();
  if (tokens.length === 0 || OPS.includes(tokens[0])) return null;

  // First pass: × and ÷
  const stack: (number | string)[] = [parseFloat(tokens[0])];
  for (let i = 1; i < tokens.length; i += 2) {
    const op = tokens[i];
    const n = parseFloat(tokens[i + 1]);
    if (op === "×" || op === "÷") {
      const prev = stack.pop() as number;
      if (op === "÷" && n === 0) return null;
      stack.push(op === "×" ? prev * n : prev / n);
    } else {
      stack.push(op, n);
    }
  }
  // Second pass: + and −
  let result = stack[0] as number;
  for (let i = 1; i < stack.length; i += 2) {
    const n = stack[i + 1] as number;
    result = stack[i] === "+" ? result + n : result - n;
  }
  return Math.round(result * 100) / 100;
}

// "Өнөөдөр", "Өчигдөр" or "10-р сарын 15" plus the time, from a datetime-local value
function formatDateLabel(value: string) {
  if (!value) return { day: "Огноо сонгох", time: "" };
  const d = new Date(value);
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOf(new Date()) - startOf(d)) / 86400000);
  const day =
    diff === 0
      ? "Өнөөдөр"
      : diff === 1
        ? "Өчигдөр"
        : `${d.getFullYear() !== new Date().getFullYear() ? `${d.getFullYear()} оны ` : ""}${d.getMonth() + 1}-р сарын ${d.getDate()}`;
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return { day, time };
}

function formatAmount(n: number) {
  const s = n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return `${s} ₮`;
}

type ReasonOption = { name: string; hint: string; builtIn: boolean };

function toOptions(items: { label: string; hint: string }[]): ReasonOption[] {
  return items.map((item) => ({ name: item.label, hint: item.hint, builtIn: true }));
}

const fallbackExpense = toOptions(EXPENSE_REASONS);
const fallbackIncome = toOptions(INCOME_REASONS);

function parseReasons(value: unknown): ReasonOption[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as { name?: unknown; hint?: unknown; builtIn?: unknown };
    if (typeof row.name !== "string" || !row.name.trim()) return [];
    return [
      {
        name: row.name,
        hint: typeof row.hint === "string" ? row.hint : "",
        builtIn: row.builtIn === true,
      },
    ];
  });
}

const glow = "shadow-[0_0_18px_rgba(168,85,247,0.45)]";
const activeBtn = `border-purple-500 bg-purple-500/15 text-purple-200 ${glow}`;
const idleBtn = "border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-600";

export default function MoneyWizard() {
  const [step, setStep] = useState(1);

  const [health, setHealth] = useState<Status>("idle");
  const [healthError, setHealthError] = useState("");

  const [type, setType] = useState<TxType | null>("expense");
  const [reason, setReason] = useState<string | null>(null);
  const [expenseReasons, setExpenseReasons] = useState<ReasonOption[]>(fallbackExpense);
  const [incomeReasons, setIncomeReasons] = useState<ReasonOption[]>(fallbackIncome);
  const [addingReason, setAddingReason] = useState(false);
  const [reasonDraft, setReasonDraft] = useState("");
  const [reasonBusy, setReasonBusy] = useState(false);
  const [reasonsError, setReasonsError] = useState("");
  const [date, setDate] = useState("");

  const [expr, setExpr] = useState("");
  const [save, setSave] = useState<Status>("idle");
  const [saveMsg, setSaveMsg] = useState("");

  const result = evaluate(expr);
  // Sign comes from the type (зарлага / орлого), so the amount itself stays positive.
  const amount = result === null ? null : Math.abs(result);

  async function loadReasons() {
    const res = await fetch("/api/reasons");
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || "Шалтгаан уншиж чадсангүй");
    const expense = parseReasons(data.expense);
    const income = parseReasons(data.income);
    if (expense.length === 0 || income.length === 0) throw new Error("Шалтгаан уншиж чадсангүй");
    setExpenseReasons(expense);
    setIncomeReasons(income);
    setReasonsError("");
  }

  async function checkServer() {
    setHealth("loading");
    setHealthError("");
    try {
      const res = await fetch("/api/health", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Сервер алдаа");
      setHealth("ok");
      setSave("idle");
      setDate(nowLocalStr());
      try {
        await loadReasons();
      } catch (err) {
        setReasonsError(err instanceof Error ? err.message : "Шалтгаан уншиж чадсангүй");
      }
      setStep(2);
    } catch (err) {
      setHealth("error");
      setHealthError(err instanceof Error ? err.message : "Алдаа гарлаа");
    }
  }

  // Hide the "saved" toast after a moment
  useEffect(() => {
    if (save !== "ok") return;
    const t = setTimeout(() => setSave("idle"), 2500);
    return () => clearTimeout(t);
  }, [save]);

  function pressDigit(d: string) {
    setSave("idle");
    setExpr((e) => {
      const cur = e.split(/[+−×÷]/).pop() ?? "";
      if (d === "000") {
        if (cur === "" || cur === "0" || cur.length > 9) return e;
        return e + "000";
      }
      if (cur.length >= 12) return e;
      if (cur === "0") return e.slice(0, -1) + d;
      return e + d;
    });
  }

  function pressOp(op: string) {
    setSave("idle");
    setExpr((e) => {
      if (e === "") return e;
      if (OPS.includes(e.slice(-1))) return e.slice(0, -1) + op;
      return e + op;
    });
  }

  function addQuick(n: number) {
    setSave("idle");
    setExpr((e) => {
      const r = evaluate(e);
      const base = r === null ? 0 : Math.abs(r);
      return String(base + n);
    });
  }

  async function addCustomReason() {
    const name = reasonDraft.trim();
    if (!name || reasonBusy || !type) return;
    const list = type === "income" ? incomeReasons : expenseReasons;
    const setList = type === "income" ? setIncomeReasons : setExpenseReasons;
    const existing = list.find((item) => item.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      setReason(existing.name);
      setReasonDraft("");
      setAddingReason(false);
      return;
    }
    setReasonBusy(true);
    setReasonsError("");
    try {
      const res = await fetch("/api/reasons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, type }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Хадгалж чадсангүй");
      const saved = typeof data.name === "string" ? data.name : name;
      setList((prev) =>
        prev.some((item) => item.name.toLowerCase() === saved.toLowerCase())
          ? prev
          : [...prev, { name: saved, hint: "", builtIn: false }],
      );
      setReason(saved);
      setReasonDraft("");
      setAddingReason(false);
    } catch (err) {
      setReasonsError(err instanceof Error ? err.message : "Алдаа гарлаа");
    } finally {
      setReasonBusy(false);
    }
  }

  async function removeCustomReason(name: string) {
    if (reasonBusy || !type) return;
    const setList = type === "income" ? setIncomeReasons : setExpenseReasons;
    setReasonBusy(true);
    setReasonsError("");
    try {
      const res = await fetch("/api/reasons", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, type }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Устгаж чадсангүй");
      setList((prev) => prev.filter((item) => item.name !== name));
      if (reason === name) setReason(null);
    } catch (err) {
      setReasonsError(err instanceof Error ? err.message : "Алдаа гарлаа");
    } finally {
      setReasonBusy(false);
    }
  }

  async function submit() {
    if (amount === null || amount <= 0 || !type) return;
    if (!reason) return;
    setSave("loading");
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          amount,
          reason,
          date: date ? new Date(date).toISOString() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Хадгалж чадсангүй");
      setSave("ok");
      setSaveMsg(
        `${type === "income" ? "Орлого" : "Зарлага"} ${formatAmount(amount)} хадгалагдлаа`,
      );
      // Stay on the amount screen so the next entry can be typed right away
      setExpr("");
    } catch (err) {
      setSave("error");
      setSaveMsg(err instanceof Error ? err.message : "Алдаа гарлаа");
    }
  }

  const canNext2 = type !== null && reason !== null;
  const reasons = type === "income" ? incomeReasons : expenseReasons;
  const canSave = amount !== null && amount > 0 && save !== "loading";

  const hasOp = /[+−×÷]/.test(expr);
  const lastCh = expr.slice(-1);
  const symbol = "₮";
  const resultText =
    expr !== "" && result === null && hasOp
      ? "—"
      : (amount ?? 0).toLocaleString("en-US", { maximumFractionDigits: 2 });
  const amountSize =
    resultText.length > 13 ? 28 : resultText.length > 10 ? 34 : resultText.length > 7 ? 40 : 48;
  const exprText = expr
    .replace(/\d+/g, (m) => Number(m).toLocaleString("en-US"))
    .replace(/([+−×÷])/g, " $1 ");
  const quick = [1000, 5000, 10000, 50000];
  const keys: { label: string; aria: string; kind: "digit" | "op" | "back" }[] = [
    { label: "1", aria: "1", kind: "digit" },
    { label: "2", aria: "2", kind: "digit" },
    { label: "3", aria: "3", kind: "digit" },
    { label: "÷", aria: "Хуваах", kind: "op" },
    { label: "4", aria: "4", kind: "digit" },
    { label: "5", aria: "5", kind: "digit" },
    { label: "6", aria: "6", kind: "digit" },
    { label: "×", aria: "Үржих", kind: "op" },
    { label: "7", aria: "7", kind: "digit" },
    { label: "8", aria: "8", kind: "digit" },
    { label: "9", aria: "9", kind: "digit" },
    { label: "−", aria: "Хасах", kind: "op" },
    { label: "000", aria: "000", kind: "digit" },
    { label: "0", aria: "0", kind: "digit" },
    { label: "", aria: "Устгах", kind: "back" },
    { label: "+", aria: "Нэмэх", kind: "op" },
  ];

  return (
    <div
      className="relative mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-6 sm:py-10"
      style={{ fontFamily: "var(--font-manrope), system-ui, sans-serif" }}
    >
      <header className="mb-6">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Мөнгөний <span className="text-purple-400">тэмдэглэл</span>
          </h1>
          <Link href="/dashboard" className="mt-1 shrink-0 text-sm font-medium text-purple-300">
            Хяналт
          </Link>
        </div>
        <div className="mt-4 flex gap-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-all ${
                s <= step ? `bg-purple-500 ${glow}` : "bg-zinc-800"
              }`}
            />
          ))}
        </div>
        <p className="mt-2 text-xs text-zinc-500">Алхам {step} / 3</p>
      </header>

      <section className="flex flex-1 flex-col rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
        {step === 1 && (
          <div className="flex flex-1 flex-col">
            <h2 className="text-lg font-medium text-white">Сервер шалгах</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Сервер болон MongoDB холболт ажиллаж байгаа эсэхийг шалгана.
            </p>

            <button
              onClick={checkServer}
              disabled={health === "loading"}
              className={`mt-6 h-14 rounded-xl border text-base font-medium transition ${
                health === "ok" ? activeBtn : idleBtn
              } disabled:opacity-60`}
            >
              {health === "loading" ? "Шалгаж байна…" : "Check"}
            </button>

            {health === "error" && (
              <p className="mt-3 text-sm text-red-400">● Алдаа: {healthError}</p>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-1 flex-col gap-6">
            <div>
              <Label>Төрөл</Label>
              <div className="grid grid-cols-2 gap-3">
                {(
                  [
                    ["income", "↓ Орлого"],
                    ["expense", "↑ Зарлага"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => {
                      if (value !== type) {
                        setReason(null);
                        setAddingReason(false);
                        setReasonDraft("");
                      }
                      setType(value);
                    }}
                    className={`h-14 rounded-xl border font-medium transition ${
                      type === value ? activeBtn : idleBtn
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {type && (
              <div>
                <Label>{type === "income" ? "Юунаас орлого орсон" : "Юунд зарлага гарсан"}</Label>
                <div className="grid grid-cols-2 gap-2">
                  {reasons.map((item) => (
                    <div key={item.name} className="relative min-w-0">
                      <button
                        type="button"
                        title={item.hint || item.name}
                        onClick={() => setReason(item.name)}
                        className={`h-10 w-full truncate rounded-xl border px-2 text-[13px] font-medium transition ${
                          item.builtIn ? "" : "pr-6"
                        } ${reason === item.name ? activeBtn : idleBtn}`}
                      >
                        {item.name}
                      </button>
                      {!item.builtIn && (
                        <button
                          type="button"
                          aria-label={`${item.name} устгах`}
                          onClick={() => removeCustomReason(item.name)}
                          disabled={reasonBusy}
                          className="absolute top-1/2 right-1 flex h-6 w-6 -translate-y-1/2 items-center justify-center text-sm text-zinc-400 hover:text-zinc-200 disabled:opacity-50"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                  {!addingReason && (
                    <button
                      type="button"
                      onClick={() => setAddingReason(true)}
                      className={`h-10 rounded-xl border text-[13px] font-medium transition ${idleBtn}`}
                    >
                      + Нэмэх
                    </button>
                  )}
                </div>
                {addingReason && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      addCustomReason();
                    }}
                    className="mt-2 flex gap-2"
                  >
                    <input
                      value={reasonDraft}
                      onChange={(e) => setReasonDraft(e.target.value)}
                      placeholder="Өөр шалтгаан"
                      maxLength={80}
                      autoFocus
                      className="h-12 min-w-0 flex-1 rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-purple-500"
                    />
                    <button
                      type="submit"
                      disabled={!reasonDraft.trim() || reasonBusy}
                      className="h-12 rounded-xl bg-purple-600 px-4 text-sm font-medium text-white disabled:bg-zinc-800 disabled:text-zinc-500"
                    >
                      {reasonBusy ? "…" : "Нэмэх"}
                    </button>
                  </form>
                )}
                {reasonsError && <p className="mt-2 text-sm text-red-400">● {reasonsError}</p>}
              </div>
            )}

            <div className="min-w-0">
              <Label>Огноо, цаг</Label>
              {/* Styled field on top; the real datetime-local input is invisible and covers it,
                  so taps still open the native picker on phones */}
              <label className="group relative flex h-14 w-full items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 px-3 transition focus-within:border-purple-500 hover:border-zinc-600">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-purple-500/15 text-purple-300">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <path d="M16 2v4M8 2v4M3 10h18" />
                  </svg>
                </span>
                <span className="flex min-w-0 flex-1 items-baseline gap-2">
                  <span className="truncate text-base font-semibold text-white">
                    {formatDateLabel(date).day}
                  </span>
                  <span className="text-sm text-zinc-400 tabular-nums">
                    {formatDateLabel(date).time}
                  </span>
                </span>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="shrink-0 text-zinc-500"
                  aria-hidden="true"
                >
                  <path d="M9 6l6 6-6 6" />
                </svg>
                <input
                  type="datetime-local"
                  aria-label="Огноо, цаг"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  onClick={(e) => {
                    // Desktop browsers only open the picker from the icon; open it on any click
                    try {
                      e.currentTarget.showPicker();
                    } catch {}
                  }}
                  className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0 [color-scheme:dark]"
                />
              </label>
            </div>

            <NavButtons
              onBack={() => setStep(1)}
              onNext={() => setStep(3)}
              nextDisabled={!canNext2}
              nextLabel="Цааш"
            />
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-1 flex-col gap-3">
            <div className="flex min-h-[140px] flex-1 flex-col items-center justify-center gap-2.5 text-center">
              <div className="text-[13px] text-[#8E8E96]">
                {type === "expense" ? "Зарлага" : "Орлого"}
                {reason ? ` · ${reason}` : ""}
              </div>
              <div aria-live="polite" className="flex max-w-full items-baseline justify-center gap-1.5">
                <span
                  className={`break-all font-extrabold leading-[1.1] tracking-[-0.03em] tabular-nums ${
                    expr === "" ? "text-[#3F3F46]" : "text-white"
                  }`}
                  style={{ fontSize: amountSize }}
                >
                  {resultText}
                </span>
                <span className="text-[22px] font-bold text-[#8E8E96]">{symbol}</span>
              </div>
              <div className="flex min-h-[22px] items-center gap-2">
                {hasOp ? (
                  <span className="rounded-lg bg-[#1A1225] px-2 py-0.5 text-[13px] font-semibold text-[#C084FC] tabular-nums">
                    {exprText}
                  </span>
                ) : (
                  <></>
                )}
              </div>
              {expr !== "" && (
                <button
                  onClick={() => {
                    setSave("idle");
                    setExpr("");
                  }}
                  className="mt-0.5 h-8 rounded-2xl border border-[#2A2A2F] px-3.5 text-[13px] font-semibold text-[#A1A1AA]"
                >
                  Арилгах
                </button>
              )}
            </div>

            <div className="grid grid-cols-4 gap-2">
              {quick.map((n) => (
                <button
                  key={n}
                  onClick={() => addQuick(n)}
                  className="h-9 rounded-[18px] border border-[#2A2A2F] bg-[#121214] text-[13px] font-semibold text-[#E4E4E7] tabular-nums active:scale-95"
                >
                  +{n >= 1000 ? `${n / 1000}k` : n}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-4 gap-2">
              {keys.map((k) => (
                <button
                  key={k.aria}
                  aria-label={k.aria}
                  onClick={() =>
                    k.kind === "op"
                      ? pressOp(k.label)
                      : k.kind === "back"
                        ? (setSave("idle"), setExpr((e) => e.slice(0, -1)))
                        : pressDigit(k.label)
                  }
                  className={`flex h-[52px] items-center justify-center rounded-xl transition active:scale-95 ${
                    k.kind === "op"
                      ? `border text-[22px] font-bold ${
                          lastCh === k.label
                            ? "border-[#A855F7] bg-[#A855F7] text-white"
                            : "border-[#4C2A78] bg-[#1A1225] text-[#C084FC]"
                        }`
                      : `bg-[#16161A] font-semibold tabular-nums ${
                          k.kind === "back"
                            ? "text-[#A1A1AA]"
                            : k.label === "000"
                              ? "text-base text-white"
                              : "text-xl text-white"
                        }`
                  }`}
                >
                  {k.kind === "back" ? (
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M21 5H9l-6 7 6 7h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1z" />
                      <path d="M17 9l-6 6" />
                      <path d="M11 9l6 6" />
                    </svg>
                  ) : (
                    k.label
                  )}
                </button>
              ))}
            </div>

            {save === "error" && <p className="text-sm text-red-400">● {saveMsg}</p>}

            <NavButtons
              onBack={() => setStep(2)}
              onNext={submit}
              nextDisabled={!canSave}
              nextLabel={
                save === "loading"
                  ? "Хадгалж байна…"
                  : hasOp && canSave
                    ? `Хадгалах · ${resultText} ${symbol}`
                    : "Хадгалах"
              }
            />
          </div>
        )}
      </section>

      {save === "ok" && (
        <div
          role="status"
          className="absolute inset-x-4 top-6 flex items-center gap-2.5 rounded-[14px] border border-[#6B21A8] bg-[#1A1225] px-4 py-3.5 text-[15px] font-semibold text-white"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#C084FC"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M20 6L9 17l-5-5" />
          </svg>
          <span>{saveMsg}</span>
        </div>
      )}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-sm font-medium text-zinc-400">{children}</p>;
}

function NavButtons({
  onBack,
  onNext,
  nextDisabled,
  nextLabel,
}: {
  onBack: () => void;
  onNext: () => void;
  nextDisabled: boolean;
  nextLabel: string;
}) {
  return (
    <div className="mt-auto grid grid-cols-3 gap-3 pt-6">
      <button
        onClick={onBack}
        className="h-12 rounded-xl border border-zinc-800 font-medium text-zinc-300 hover:border-zinc-600"
      >
        Буцах
      </button>
      <button
        onClick={onNext}
        disabled={nextDisabled}
        className="col-span-2 h-12 rounded-xl bg-purple-600 font-medium text-white transition hover:bg-purple-500 disabled:bg-zinc-800 disabled:text-zinc-500"
      >
        {nextLabel}
      </button>
    </div>
  );
}
