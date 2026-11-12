"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { TRAVEL_REASONS } from "@/lib/travel-reasons";

type Currency = "CNY" | "MNT";
type Status = "idle" | "loading" | "ok" | "error";

const OPS = ["+", "−", "×", "÷"];

function nowLocalStr() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function evaluate(expr: string): number | null {
  const tokens = expr.match(/\d+\.?\d*|\.\d+|[+−×÷]/g);
  if (!tokens || tokens.length === 0) return null;
  if (OPS.includes(tokens[tokens.length - 1])) tokens.pop();
  if (tokens.length === 0 || OPS.includes(tokens[0])) return null;

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
  let result = stack[0] as number;
  for (let i = 1; i < stack.length; i += 2) {
    const n = stack[i + 1] as number;
    result = stack[i] === "+" ? result + n : result - n;
  }
  return Math.round(result * 100) / 100;
}

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

type ReasonOption = { name: string; hint: string; builtIn: boolean };

function toOptions(items: { label: string; hint: string }[]): ReasonOption[] {
  return items.map((item) => ({ name: item.label, hint: item.hint, builtIn: true }));
}

const fallbackReasons = toOptions(TRAVEL_REASONS);

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

const glow = "shadow-[0_0_18px_rgba(249,115,22,0.45)]";
const activeBtn = `border-orange-500 bg-orange-500/15 text-orange-200 ${glow}`;
const idleBtn = "border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-600";

export default function TravelWizard() {
  const [step, setStep] = useState(1);

  const [health, setHealth] = useState<Status>("idle");
  const [healthError, setHealthError] = useState("");

  const [reason, setReason] = useState<string | null>(null);
  const [reasons, setReasons] = useState<ReasonOption[]>(fallbackReasons);
  const [addingReason, setAddingReason] = useState(false);
  const [reasonDraft, setReasonDraft] = useState("");
  const [reasonBusy, setReasonBusy] = useState(false);
  const [reasonsError, setReasonsError] = useState("");
  const [date, setDate] = useState("");

  const [currency, setCurrency] = useState<Currency>("CNY");
  const [rate, setRate] = useState<number | null>(null);
  const [rateError, setRateError] = useState("");

  const [expr, setExpr] = useState("");
  const [save, setSave] = useState<Status>("idle");
  const [saveMsg, setSaveMsg] = useState("");

  const result = evaluate(expr);
  const amount = result === null ? null : Math.abs(result);

  const convertedMnt =
    amount !== null && rate !== null && currency === "CNY"
      ? Math.round(amount * rate * 100) / 100
      : null;
  const convertedCny =
    amount !== null && rate !== null && currency === "MNT" && rate > 0
      ? Math.round((amount / rate) * 100) / 100
      : null;

  async function loadReasons() {
    const res = await fetch("/api/travel/reasons");
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || "Ангилал уншиж чадсангүй");
    const list = parseReasons(data.reasons);
    if (list.length === 0) throw new Error("Ангилал уншиж чадсангүй");
    setReasons(list);
    setReasonsError("");
  }

  async function loadRate() {
    try {
      const res = await fetch("/api/travel/rate");
      const data = await res.json();
      if (!res.ok || !data.ok || typeof data.rate !== "number") {
        throw new Error(data.error || "Ханш уншиж чадсангүй");
      }
      setRate(data.rate);
      setRateError("");
    } catch (err) {
      setRateError(err instanceof Error ? err.message : "Ханш алдаа");
    }
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
        setReasonsError(err instanceof Error ? err.message : "Ангилал уншиж чадсангүй");
      }
      void loadRate();
      setStep(2);
    } catch (err) {
      setHealth("error");
      setHealthError(err instanceof Error ? err.message : "Алдаа гарлаа");
    }
  }

  useEffect(() => {
    if (save !== "ok") return;
    const t = setTimeout(() => setSave("idle"), 2500);
    return () => clearTimeout(t);
  }, [save]);

  // Refresh rate while on amount step for live preview
  useEffect(() => {
    if (step !== 3) return;
    void loadRate();
    const id = setInterval(() => void loadRate(), 60_000);
    return () => clearInterval(id);
  }, [step]);

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
    if (!name || reasonBusy) return;
    const existing = reasons.find((item) => item.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      setReason(existing.name);
      setReasonDraft("");
      setAddingReason(false);
      return;
    }
    setReasonBusy(true);
    setReasonsError("");
    try {
      const res = await fetch("/api/travel/reasons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Хадгалж чадсангүй");
      const saved = typeof data.name === "string" ? data.name : name;
      setReasons((prev) =>
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

  async function submit() {
    if (amount === null || amount <= 0 || !reason) return;
    setSave("loading");
    try {
      const res = await fetch("/api/travel/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          currency,
          reason,
          date: date ? new Date(date).toISOString() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Хадгалж чадсангүй");

      const mnt =
        typeof data.amountMnt === "number"
          ? data.amountMnt
          : currency === "MNT"
            ? amount
            : null;
      const cny =
        typeof data.amountCny === "number"
          ? data.amountCny
          : currency === "CNY"
            ? amount
            : null;
      const snapRate = typeof data.rate === "number" ? data.rate : rate;
      if (typeof snapRate === "number") setRate(snapRate);

      const mntText = (mnt ?? 0).toLocaleString("en-US", { maximumFractionDigits: 2 });
      const cnyText = (cny ?? 0).toLocaleString("en-US", { maximumFractionDigits: 2 });
      setSave("ok");
      setSaveMsg(
        currency === "CNY"
          ? `Зарлага ${cnyText} ¥ ≈ ${mntText} ₮ хадгалагдлаа`
          : `Зарлага ${mntText} ₮ ≈ ${cnyText} ¥ хадгалагдлаа`,
      );
      setExpr("");
    } catch (err) {
      setSave("error");
      setSaveMsg(err instanceof Error ? err.message : "Алдаа гарлаа");
    }
  }

  const canNext2 = reason !== null;
  const canSave = amount !== null && amount > 0 && save !== "loading";

  const hasOp = /[+−×÷]/.test(expr);
  const lastCh = expr.slice(-1);
  const symbol = currency === "CNY" ? "¥" : "₮";
  const resultText =
    expr !== "" && result === null && hasOp
      ? "—"
      : (amount ?? 0).toLocaleString("en-US", { maximumFractionDigits: 2 });
  const amountSize =
    resultText.length > 13 ? 28 : resultText.length > 10 ? 34 : resultText.length > 7 ? 40 : 48;
  const exprText = expr
    .replace(/\d+/g, (m) => Number(m).toLocaleString("en-US"))
    .replace(/([+−×÷])/g, " $1 ");
  const quick = currency === "CNY" ? [10, 50, 100, 500] : [1000, 5000, 10000, 50000];
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

  const previewLine =
    currency === "CNY" && convertedMnt !== null
      ? `≈ ${convertedMnt.toLocaleString("en-US", { maximumFractionDigits: 2 })} ₮`
      : currency === "MNT" && convertedCny !== null
        ? `≈ ${convertedCny.toLocaleString("en-US", { maximumFractionDigits: 2 })} ¥`
        : rateError
          ? rateError
          : rate === null
            ? "Ханш ачаалж байна…"
            : "";

  return (
    <div
      className="relative mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-6 sm:py-10"
      style={{ fontFamily: "var(--font-manrope), system-ui, sans-serif" }}
    >
      <header className="mb-6">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Хятад <span className="text-orange-400">аялал</span>
          </h1>
          <Link href="/travel/dashboard" className="mt-1 shrink-0 text-sm font-medium text-orange-300">
            Хяналт
          </Link>
        </div>
        <div className="mt-4 flex gap-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-all ${
                s <= step ? `bg-orange-500 ${glow}` : "bg-zinc-800"
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
              <Label>Ангилал</Label>
              <div className="grid grid-cols-2 gap-2">
                {reasons.map((item) => (
                  <button
                    key={item.name}
                    type="button"
                    title={item.hint || item.name}
                    onClick={() => setReason(item.name)}
                    className={`h-10 w-full truncate rounded-xl border px-2 text-[13px] font-medium transition ${
                      reason === item.name ? activeBtn : idleBtn
                    }`}
                  >
                    {item.name}
                  </button>
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
                    placeholder="Шинэ ангилал"
                    maxLength={80}
                    autoFocus
                    className="h-12 min-w-0 flex-1 rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-orange-500"
                  />
                  <button
                    type="submit"
                    disabled={!reasonDraft.trim() || reasonBusy}
                    className="h-12 rounded-xl bg-red-600 px-4 text-sm font-medium text-white disabled:bg-zinc-800 disabled:text-zinc-500"
                  >
                    {reasonBusy ? "…" : "Нэмэх"}
                  </button>
                </form>
              )}
              {reasonsError && <p className="mt-2 text-sm text-red-400">● {reasonsError}</p>}
            </div>

            <div className="min-w-0">
              <Label>Огноо, цаг</Label>
              <label className="group relative flex h-14 w-full items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 px-3 transition focus-within:border-orange-500 hover:border-zinc-600">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-500/15 text-orange-300">
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
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ["CNY", "¥ Юань"],
                  ["MNT", "₮ Төгрөг"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setCurrency(value);
                    setSave("idle");
                    setExpr("");
                  }}
                  className={`h-10 rounded-xl border text-[13px] font-medium transition ${
                    currency === value ? activeBtn : idleBtn
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex min-h-[140px] flex-1 flex-col items-center justify-center gap-2.5 text-center">
              <div className="text-[13px] text-[#8E8E96]">
                Зарлага{reason ? ` · ${reason}` : ""}
                {rate !== null
                  ? ` · 1¥ = ${rate.toLocaleString("en-US", { maximumFractionDigits: 2 })}₮`
                  : ""}
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
              <div className="min-h-[22px] text-[13px] font-semibold tabular-nums text-orange-300">
                {amount !== null && amount > 0 ? previewLine : ""}
              </div>
              <div className="flex min-h-[22px] items-center gap-2">
                {hasOp ? (
                  <span className="rounded-lg bg-[#2A1510] px-2 py-0.5 text-[13px] font-semibold text-orange-300 tabular-nums">
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
                            ? "border-orange-500 bg-orange-500 text-white"
                            : "border-orange-900 bg-[#2A1510] text-orange-300"
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
          className="absolute inset-x-4 top-6 flex items-center gap-2.5 rounded-[14px] border border-red-800 bg-[#2A1510] px-4 py-3.5 text-[15px] font-semibold text-white"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#FB923C"
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
        className="col-span-2 h-12 rounded-xl bg-red-600 font-medium text-white transition hover:bg-red-500 disabled:bg-zinc-800 disabled:text-zinc-500"
      >
        {nextLabel}
      </button>
    </div>
  );
}
