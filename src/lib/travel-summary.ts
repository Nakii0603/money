import { connection } from "next/server";
import { getDb } from "@/lib/mongodb";

const TZ = "Asia/Ulaanbaatar";

export type ReasonTotal = { name: string; amountMnt: number; amountCny: number };

export type RecentTravelTx = {
  id: string;
  currency: "CNY" | "MNT";
  amountOriginal: number;
  amountCny: number;
  amountMnt: number;
  rate: number;
  reason: string;
  when: string;
};

export type TravelDashboardData = {
  totalMnt: number;
  totalCny: number;
  count: number;
  reasons: ReasonTotal[];
  recent: RecentTravelTx[];
};

type TravelTx = {
  id: string;
  currency: "CNY" | "MNT";
  amountOriginal: number;
  amountCny: number;
  amountMnt: number;
  rate: number;
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

function reasonTotals(rows: TravelTx[]): ReasonTotal[] {
  const map = new Map<string, { amountMnt: number; amountCny: number }>();
  for (const row of rows) {
    const prev = map.get(row.reason) ?? { amountMnt: 0, amountCny: 0 };
    map.set(row.reason, {
      amountMnt: prev.amountMnt + row.amountMnt,
      amountCny: prev.amountCny + row.amountCny,
    });
  }
  return [...map.entries()]
    .map(([name, amounts]) => ({ name, ...amounts }))
    .sort((a, b) => b.amountMnt - a.amountMnt);
}

export async function loadTravelDashboard(): Promise<TravelDashboardData> {
  await connection();
  const now = new Date();
  const db = await getDb();
  const docs = await db.collection("travel_transactions").find({}).sort({ date: -1 }).toArray();

  const txs: TravelTx[] = [];
  for (const doc of docs) {
    const amountMnt =
      typeof doc.amountMnt === "number" && Number.isFinite(doc.amountMnt) ? doc.amountMnt : null;
    const amountCny =
      typeof doc.amountCny === "number" && Number.isFinite(doc.amountCny) ? doc.amountCny : null;
    const amountOriginal =
      typeof doc.amountOriginal === "number" && Number.isFinite(doc.amountOriginal)
        ? doc.amountOriginal
        : null;
    const rate = typeof doc.rate === "number" && Number.isFinite(doc.rate) ? doc.rate : null;
    const currency = doc.currency === "CNY" || doc.currency === "MNT" ? doc.currency : null;
    const date = doc.date instanceof Date ? doc.date : new Date(String(doc.date ?? ""));
    if (
      amountMnt === null ||
      amountMnt <= 0 ||
      amountCny === null ||
      amountCny <= 0 ||
      amountOriginal === null ||
      rate === null ||
      !currency ||
      Number.isNaN(date.getTime())
    ) {
      continue;
    }
    const reason =
      typeof doc.reason === "string" && doc.reason.trim() ? doc.reason.trim() : "Тодорхойгүй";
    txs.push({
      id: doc._id.toString(),
      currency,
      amountOriginal,
      amountCny,
      amountMnt,
      rate,
      reason,
      date,
    });
  }

  const today = clockParts(now);
  const totalMnt = txs.reduce((sum, tx) => sum + tx.amountMnt, 0);
  const totalCny = txs.reduce((sum, tx) => sum + tx.amountCny, 0);

  return {
    totalMnt,
    totalCny,
    count: txs.length,
    reasons: reasonTotals(txs),
    recent: txs.map((tx) => ({
      id: tx.id,
      currency: tx.currency,
      amountOriginal: tx.amountOriginal,
      amountCny: tx.amountCny,
      amountMnt: tx.amountMnt,
      rate: tx.rate,
      reason: tx.reason,
      when: whenLabel(tx.date, today.key),
    })),
  };
}

export function formatTugrik(n: number) {
  return `${n.toLocaleString("en-US", { maximumFractionDigits: 2 })} ₮`;
}

export function formatYuan(n: number) {
  return `${n.toLocaleString("en-US", { maximumFractionDigits: 2 })} ¥`;
}
