import { connection } from "next/server";
import { getDb } from "@/lib/mongodb";

const TZ = "Asia/Ulaanbaatar";

export type TxType = "income" | "expense";

export type ReasonTotal = { name: string; amount: number };

export type RecentTx = {
  id: string;
  type: TxType;
  amount: number;
  reason: string;
  when: string;
};

export type DashboardData = {
  monthLabel: string;
  income: number;
  expense: number;
  count: number;
  expenseReasons: ReasonTotal[];
  incomeReasons: ReasonTotal[];
  recent: RecentTx[];
};

type Tx = {
  id: string;
  type: TxType;
  amount: number;
  reason: string;
  date: Date;
};

function clockParts(date: Date) {
  const map = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: TZ,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  const year = Number(map.year);
  const month = Number(map.month);
  const day = Number(map.day);
  return {
    year,
    month,
    day,
    time: `${map.hour}:${map.minute}`,
    key: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
  };
}

function shiftKey(key: string, days: number) {
  const [year, month, day] = key.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
}

function whenLabel(date: Date, todayKey: string) {
  const parts = clockParts(date);
  const day =
    parts.key === todayKey
      ? "Өнөөдөр"
      : parts.key === shiftKey(todayKey, -1)
        ? "Өчигдөр"
        : `${parts.year !== Number(todayKey.slice(0, 4)) ? `${parts.year} оны ` : ""}${parts.month}-р сарын ${parts.day}`;
  return `${day} ${parts.time}`;
}

function totals(rows: Tx[], pick: TxType) {
  const map = new Map<string, number>();
  for (const row of rows) {
    if (row.type !== pick) continue;
    map.set(row.reason, (map.get(row.reason) ?? 0) + row.amount);
  }
  return [...map.entries()]
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount);
}

export async function loadDashboard(): Promise<DashboardData> {
  await connection();
  const now = new Date();
  const db = await getDb();
  const docs = await db.collection("transactions").find({}).sort({ date: -1 }).toArray();
  const txs: Tx[] = [];
  for (const doc of docs) {
    const type = doc.type === "income" || doc.type === "expense" ? doc.type : null;
    const amount = typeof doc.amount === "number" && Number.isFinite(doc.amount) ? doc.amount : null;
    const date = doc.date instanceof Date ? doc.date : new Date(String(doc.date ?? ""));
    if (!type || amount === null || amount <= 0 || Number.isNaN(date.getTime())) continue;
    const reason = typeof doc.reason === "string" && doc.reason.trim() ? doc.reason.trim() : "Тодорхойгүй";
    txs.push({ id: doc._id.toString(), type, amount, reason, date });
  }

  const today = clockParts(now);
  const monthKey = today.key.slice(0, 7);
  const monthTxs = txs.filter((tx) => clockParts(tx.date).key.startsWith(monthKey));
  const income = monthTxs.filter((tx) => tx.type === "income").reduce((sum, tx) => sum + tx.amount, 0);
  const expense = monthTxs.filter((tx) => tx.type === "expense").reduce((sum, tx) => sum + tx.amount, 0);

  return {
    monthLabel: `${today.month}-р сар`,
    income,
    expense,
    count: monthTxs.length,
    incomeReasons: totals(monthTxs, "income"),
    expenseReasons: totals(monthTxs, "expense"),
    recent: txs.slice(0, 30).map((tx) => ({
      id: tx.id,
      type: tx.type,
      amount: tx.amount,
      reason: tx.reason,
      when: whenLabel(tx.date, today.key),
    })),
  };
}

export function formatTugrik(n: number) {
  return `${n.toLocaleString("en-US", { maximumFractionDigits: 2 })} ₮`;
}
