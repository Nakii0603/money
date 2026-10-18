import { getDb } from "@/lib/mongodb";

export async function POST() {
  try {
    const db = await getDb();
    await db.command({ ping: 1 });
    const checkedAt = new Date();
    await db.collection("health_checks").insertOne({ ok: true, checkedAt });
    return Response.json({ ok: true, checkedAt });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
