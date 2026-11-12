import { getCnyToMntRateForSave, roundMoney } from "@/lib/fx";
import { getDb } from "@/lib/mongodb";
import { REASON_MAX } from "@/lib/travel-reasons";

const CURRENCIES = ["CNY", "MNT"] as const;

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const { amount, date, reason, currency } = body;
  const reasonText = typeof reason === "string" ? reason.trim() : "";
  const cur = currency as (typeof CURRENCIES)[number];

  if (!CURRENCIES.includes(cur)) {
    return Response.json({ ok: false, error: "Invalid currency" }, { status: 400 });
  }
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    return Response.json({ ok: false, error: "Invalid amount" }, { status: 400 });
  }
  if (reasonText.length === 0 || reasonText.length > REASON_MAX) {
    return Response.json({ ok: false, error: "Invalid reason" }, { status: 400 });
  }

  let when = new Date();
  if (date !== undefined && date !== null && date !== "") {
    const parsed = new Date(String(date));
    if (Number.isNaN(parsed.getTime())) {
      return Response.json({ ok: false, error: "Invalid date" }, { status: 400 });
    }
    when = parsed;
  }

  try {
    // Snapshot rate at save time — not the client's preview rate alone
    const rate = await getCnyToMntRateForSave();
    const amountOriginal = roundMoney(amount);

    let amountCny: number;
    let amountMnt: number;
    if (cur === "CNY") {
      amountCny = amountOriginal;
      amountMnt = roundMoney(amountCny * rate);
    } else {
      amountMnt = amountOriginal;
      amountCny = roundMoney(amountMnt / rate);
    }

    const db = await getDb();
    const result = await db.collection("travel_transactions").insertOne({
      type: "expense",
      currency: cur,
      amountOriginal,
      amountCny,
      amountMnt,
      rate,
      reason: reasonText,
      date: when,
      createdAt: new Date(),
    });

    return Response.json({
      ok: true,
      id: result.insertedId.toString(),
      amountCny,
      amountMnt,
      rate,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
