export const TRAVEL_REASONS: { label: string; hint: string }[] = [
  { label: "Хоол", hint: "хоол унд" },
  { label: "Shopping", hint: "худалдан авалт" },
  { label: "Үзвэр", hint: "үзвэр үйлчилгээ" },
  { label: "Үйлчилгээ", hint: "бусад үйлчилгээ" },
];

export const REASON_MAX = 80;

export function cleanReasonName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim();
  if (!name || name.length > REASON_MAX) return null;
  return name;
}

export function isBuiltInTravelReason(name: string) {
  const key = name.toLowerCase();
  return TRAVEL_REASONS.some((item) => item.label.toLowerCase() === key);
}
