import { getDb } from "@/lib/mongodb";
import {
  TRAVEL_REASONS,
  cleanReasonName,
  isBuiltInTravelReason,
} from "@/lib/travel-reasons";

type ReasonDoc = {
  name: string;
  hint?: string;
  builtIn?: boolean;
  createdAt: Date;
};

async function reasonsCollection() {
  const db = await getDb();
  return db.collection<ReasonDoc>("travel_reasons");
}

function toReason(doc: ReasonDoc) {
  return {
    name: doc.name,
    hint: typeof doc.hint === "string" ? doc.hint : "",
    builtIn: doc.builtIn === true,
  };
}

async function ensureBuiltInReasons() {
  const collection = await reasonsCollection();
  await collection.bulkWrite(
    TRAVEL_REASONS.map((item) => ({
      updateOne: {
        filter: { name: item.label },
        update: {
          $set: { hint: item.hint, builtIn: true },
          $setOnInsert: { name: item.label, createdAt: new Date() },
        },
        upsert: true,
      },
    })),
  );
  return collection;
}

function sortReasons(docs: ReasonDoc[]) {
  const order = new Map(TRAVEL_REASONS.map((item, index) => [item.label, index]));
  return [...docs].sort((a, b) => {
    const aOrder = order.get(a.name);
    const bOrder = order.get(b.name);
    if (aOrder !== undefined || bOrder !== undefined) {
      return (aOrder ?? Number.MAX_SAFE_INTEGER) - (bOrder ?? Number.MAX_SAFE_INTEGER);
    }
    const aTime = a.createdAt instanceof Date ? a.createdAt.getTime() : 0;
    const bTime = b.createdAt instanceof Date ? b.createdAt.getTime() : 0;
    return aTime - bTime;
  });
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET() {
  try {
    const collection = await ensureBuiltInReasons();
    const docs = (await collection.find({}).toArray()).filter(
      (doc) => typeof doc.name === "string" && doc.name.trim(),
    );
    return Response.json({
      ok: true,
      reasons: sortReasons(docs).map(toReason),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const name = cleanReasonName(body.name);
  if (!name || isBuiltInTravelReason(name)) {
    return Response.json({ ok: false, error: "Invalid reason" }, { status: 400 });
  }

  try {
    const collection = await ensureBuiltInReasons();
    const existing = await collection.findOne({
      name: { $regex: `^${escapeRegex(name)}$`, $options: "i" },
    });
    if (existing) {
      return Response.json({ ok: true, name: existing.name });
    }
    await collection.insertOne({
      name,
      hint: "",
      builtIn: false,
      createdAt: new Date(),
    });
    return Response.json({ ok: true, name });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
