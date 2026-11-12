type CachedRate = {
  rate: number;
  fetchedAt: number;
};

const globalForFx = globalThis as unknown as {
  _cnyMntRateCache?: CachedRate;
};

const CACHE_MS = 12 * 60 * 1000; // ~12 min — UI preview only

function roundRate(n: number) {
  return Math.round(n * 10000) / 10000;
}

export function roundMoney(n: number) {
  return Math.round(n * 100) / 100;
}

async function fetchCnyToMnt(): Promise<number> {
  const res = await fetch("https://open.er-api.com/v6/latest/CNY", {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Rate HTTP ${res.status}`);
  const data = (await res.json()) as {
    result?: string;
    rates?: { MNT?: number };
  };
  if (data.result !== "success" || typeof data.rates?.MNT !== "number" || data.rates.MNT <= 0) {
    throw new Error("Invalid CNY→MNT rate");
  }
  return roundRate(data.rates.MNT);
}

/** Live/preview rate with short in-memory cache; falls back to last cache on fetch failure. */
export async function getCnyToMntRate(): Promise<{ rate: number; cached: boolean; fetchedAt: number }> {
  const now = Date.now();
  const cached = globalForFx._cnyMntRateCache;
  if (cached && now - cached.fetchedAt < CACHE_MS) {
    return { rate: cached.rate, cached: true, fetchedAt: cached.fetchedAt };
  }

  try {
    const rate = await fetchCnyToMnt();
    globalForFx._cnyMntRateCache = { rate, fetchedAt: now };
    return { rate, cached: false, fetchedAt: now };
  } catch (err) {
    if (cached) {
      return { rate: cached.rate, cached: true, fetchedAt: cached.fetchedAt };
    }
    throw err;
  }
}

/** Prefer a fresh fetch for save-time snapshot; fall back to cache if network fails. */
export async function getCnyToMntRateForSave(): Promise<number> {
  try {
    const rate = await fetchCnyToMnt();
    globalForFx._cnyMntRateCache = { rate, fetchedAt: Date.now() };
    return rate;
  } catch {
    const cached = globalForFx._cnyMntRateCache;
    if (cached) return cached.rate;
    // Last resort: try the cached-path helper which may still throw
    const { rate } = await getCnyToMntRate();
    return rate;
  }
}
