import {
  formatTugrik,
  formatYuan,
  loadTravelDashboard,
  type ReasonTotal,
} from "@/lib/travel-summary";

export async function TravelDashboardBody() {
  const data = await loadTravelDashboard();

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
        <p className="text-sm text-zinc-400">Нийт зарлага</p>
        <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-orange-300">
          {formatTugrik(data.totalMnt)}
        </p>
        <p className="mt-1 text-sm text-zinc-500">
          {formatYuan(data.totalCny)} · {data.count} гүйлгээ
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Stat label="Нийт ¥" value={formatYuan(data.totalCny)} tone="text-orange-300" />
          <Stat label="Нийт ₮" value={formatTugrik(data.totalMnt)} tone="text-zinc-200" />
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
        <h2 className="text-sm font-medium text-zinc-400">Ангиллаар</h2>
        <ReasonBars rows={data.reasons} empty="Одоогоор зарлага алга" />
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
        <h2 className="text-sm font-medium text-zinc-400">Бүх гүйлгээ</h2>
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
                    Зарлага
                    <span className="text-zinc-500"> · {tx.reason}</span>
                  </p>
                  <p className="text-xs text-zinc-500">
                    {tx.when}
                    {tx.currency === "CNY"
                      ? ` · ${formatYuan(tx.amountOriginal)}`
                      : ` · ${formatTugrik(tx.amountOriginal)}`}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold tabular-nums text-zinc-200">
                    {formatTugrik(tx.amountMnt)}
                  </p>
                  <p className="text-xs tabular-nums text-orange-300/80">
                    {formatYuan(tx.amountCny)}
                  </p>
                </div>
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

function ReasonBars({ rows, empty }: { rows: ReasonTotal[]; empty: string }) {
  if (rows.length === 0) return <p className="mt-3 text-sm text-zinc-500">{empty}</p>;
  const max = rows[0].amountMnt;
  return (
    <ul className="mt-4 flex flex-col gap-3">
      {rows.map((row) => (
        <li key={row.name}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">{row.name}</span>
            <span className="shrink-0 text-right">
              <span className="block tabular-nums text-zinc-300">{formatTugrik(row.amountMnt)}</span>
              <span className="block text-xs tabular-nums text-orange-300/80">
                {formatYuan(row.amountCny)}
              </span>
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-orange-500"
              style={{ width: `${Math.max(8, (row.amountMnt / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function TravelDashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {[140, 96, 180].map((height) => (
        <div
          key={height}
          className="animate-pulse rounded-2xl border border-zinc-800 bg-zinc-950"
          style={{ height }}
        />
      ))}
    </div>
  );
}
