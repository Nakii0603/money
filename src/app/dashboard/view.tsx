import { formatTugrik, loadDashboard, type ReasonTotal } from "@/lib/summary";

export async function DashboardBody() {
  const data = await loadDashboard();
  const ahead = data.income - data.expense;

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
        <p className="text-sm text-zinc-400">{data.monthLabel}</p>
        <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">
          {formatTugrik(Math.abs(ahead))}
        </p>
        <p className="mt-1 text-sm text-zinc-500">
          {ahead > 0 ? "Орлого илүү" : ahead < 0 ? "Зарлага илүү" : "Тэнцүү"} · {data.count} гүйлгээ
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Stat label="Орлого" value={formatTugrik(data.income)} tone="text-purple-300" />
          <Stat label="Зарлага" value={formatTugrik(data.expense)} tone="text-zinc-200" />
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
        <h2 className="text-sm font-medium text-zinc-400">Орлого</h2>
        <ReasonBars rows={data.incomeReasons} tone="bg-purple-500" empty="Энэ сард орлого алга" />
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
        <h2 className="text-sm font-medium text-zinc-400">Зарлага</h2>
        <ReasonBars rows={data.expenseReasons} tone="bg-zinc-300" empty="Энэ сард зарлага алга" />
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
        <h2 className="text-sm font-medium text-zinc-400">Сүүлийн гүйлгээ</h2>
        {data.recent.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">Одоогоор гүйлгээ алга.</p>
        ) : (
          <ul className="mt-1">
            {data.recent.map((tx) => (
              <li
                key={tx.id}
                className="flex items-center justify-between gap-3 border-b border-zinc-900 py-3 last:border-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {tx.type === "income" ? "Орлого" : "Зарлага"}
                    <span className="text-zinc-500"> · {tx.reason}</span>
                  </p>
                  <p className="text-xs text-zinc-500">{tx.when}</p>
                </div>
                <p
                  className={`shrink-0 text-sm font-semibold tabular-nums ${
                    tx.type === "income" ? "text-purple-300" : "text-zinc-200"
                  }`}
                >
                  {formatTugrik(tx.amount)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-black px-3 py-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={`mt-1 text-sm font-semibold tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}

function ReasonBars({
  rows,
  tone,
  empty,
}: {
  rows: ReasonTotal[];
  tone: string;
  empty: string;
}) {
  if (rows.length === 0) return <p className="mt-3 text-sm text-zinc-500">{empty}</p>;
  const max = rows[0].amount;
  return (
    <ul className="mt-4 flex flex-col gap-3">
      {rows.map((row) => (
        <li key={row.name}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">{row.name}</span>
            <span className="shrink-0 tabular-nums text-zinc-400">{formatTugrik(row.amount)}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
            <div
              className={`h-full rounded-full ${tone}`}
              style={{ width: `${Math.max(8, (row.amount / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {[140, 96, 96, 180].map((height) => (
        <div
          key={height}
          className="animate-pulse rounded-2xl border border-zinc-800 bg-zinc-950"
          style={{ height }}
        />
      ))}
    </div>
  );
}
