import { getDb } from "@/lib/mongodb";
import {
  EXPENSE_REASONS,
  INCOME_REASONS,
  REASON_KINDS,
  cleanReasonName,
  isBuiltInReason,
  type ReasonKind,
} from "@/lib/reasons";

type ReasonDoc = {
  name: string;
  hint?: string;
  builtIn?: boolean;
  kind?: ReasonKind;
  createdAt: Date;
};

async function reasonsCollection() {
  const db = await getDb();
  return db.collection<ReasonDoc>("reasons");
}

function toReason(doc: ReasonDoc) {
  return {
    name: doc.name,
    hint: typeof doc.hint === "string" ? doc.hint : "",
    builtIn: doc.builtIn === true,
  };
}

const REASON_GROUPS: { kind: ReasonKind; items: { label: string; hint: string }[] }[] = [
  { kind: "expense", items: EXPENSE_REASONS },
  { kind: "income", items: INCOME_REASONS },
];

async function ensureBuiltInReasons() {
  const collection = await reasonsCollection();
  await collection.updateMany({ kind: { $exists: false } }, { $set: { kind: "expense" } });
  await collection.bulkWrite(
    REASON_GROUPS.flatMap((group) =>
      group.items.map((item) => ({
        updateOne: {
          filter: { name: item.label, kind: group.kind },
          update: {
            $set: { hint: item.hint, builtIn: true, kind: group.kind },
            $setOnInsert: { name: item.label, createdAt: new Date() },
          },
          upsert: true,
        },
      })),
    ),
  );
  return collection;
}

function sortReasons(docs: ReasonDoc[], seed: { label: string }[]) {
  const order = new Map(seed.map((item, index) => [item.label, index]));
  return [...docs].sort((a, b) => {
    const aOrder = order.get(a.name);
    const bOrder = order.get(b.name);
    if (aOrder !== undefined || bOrder !== undefined) {
      return (aOrder ?? Number.MAX_SAFE_INTEGER) - (bOrder ?? Number.MAX_SAFE_INTEGER);
    }
    return createdAtTime(a) - createdAtTime(b);
  });
}

function isReasonKind(value: unknown): value is ReasonKind {
  return REASON_KINDS.includes(value as ReasonKind);
}

export async function GET() {
  try {
    const collection = await ensureBuiltInReasons();
    const docs = (await collection.find({}).toArray()).filter(
      (doc) => typeof doc.name === "string" && doc.name.trim(),
    );
    return Response.json({
      ok: true,
      expense: sortReasons(
        docs.filter((doc) => doc.kind !== "income"),
        EXPENSE_REASONS,
      ).map(toReason),
      income: sortReasons(
        docs.filter((doc) => doc.kind === "income"),
        INCOME_REASONS,
      ).map(toReason),
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
  const kind = body.type;
  if (!name || !isReasonKind(kind) || isBuiltInReason(name)) {
    return Response.json({ ok: false, error: "Invalid reason" }, { status: 400 });
  }

  try {
    const collection = await ensureBuiltInReasons();
    const existing = await collection.findOne({
      kind,
      name: { $regex: `^${escapeRegex(name)}$`, $options: "i" },
    });
    if (existing) {
      return Response.json({ ok: true, name: existing.name });
    }
    await collection.insertOne({ name, hint: "", builtIn: false, kind, createdAt: new Date() });
    return Response.json({ ok: true, name });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const name = cleanReasonName(body.name);
  const kind = body.type;
  if (!name || !isReasonKind(kind)) {
    return Response.json({ ok: false, error: "Invalid reason" }, { status: 400 });
  }

  try {
    const collection = await reasonsCollection();
    const existing = await collection.findOne({ name, kind });
    if (existing?.builtIn) {
      return Response.json({ ok: false, error: "Built-in reason" }, { status: 400 });
    }
    await collection.deleteOne({ name, kind });
    return Response.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

function createdAtTime(doc: ReasonDoc) {
  return doc.createdAt instanceof Date ? doc.createdAt.getTime() : 0;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
