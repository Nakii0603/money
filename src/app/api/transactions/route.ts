import { getDb } from "@/lib/mongodb";

const TYPES = ["income", "expense"] as const;
const CURRENCIES = ["MNT", "USD"] as const;

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const { type, currency, amount, date } = body;

  if (!TYPES.includes(type as (typeof TYPES)[number])) {
    return Response.json({ ok: false, error: "Invalid type" }, { status: 400 });
  }
  if (!CURRENCIES.includes(currency as (typeof CURRENCIES)[number])) {
    return Response.json({ ok: false, error: "Invalid currency" }, { status: 400 });
  }
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    return Response.json({ ok: false, error: "Invalid amount" }, { status: 400 });
  }

  // Use the selected date if provided, otherwise fall back to now
  let when = new Date();
  if (date !== undefined && date !== null && date !== "") {
    const parsed = new Date(String(date));
    if (Number.isNaN(parsed.getTime())) {
      return Response.json({ ok: false, error: "Invalid date" }, { status: 400 });
    }
    when = parsed;
  }

  try {
    const db = await getDb();
    const result = await db.collection("transactions").insertOne({
      type,
      currency,
      amount,
      date: when,
      createdAt: new Date(),
    });
    return Response.json({ ok: true, id: result.insertedId.toString() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
