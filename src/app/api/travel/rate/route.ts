import { getCnyToMntRate } from "@/lib/fx";

export async function GET() {
  try {
    const { rate, cached, fetchedAt } = await getCnyToMntRate();
    return Response.json({
      ok: true,
      base: "CNY",
      quote: "MNT",
      rate,
      cached,
      fetchedAt: new Date(fetchedAt).toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
