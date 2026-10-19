export const EXPENSE_REASONS: { label: string; hint: string }[] = [
  { label: "Хоол", hint: "гадуур хооллолт" },
  { label: "Хүнс", hint: "дэлгүүрээс авсан хүнс, ногоо" },
  { label: "Subscription", hint: "сар бүрд авдаг төлбөр" },
  { label: "Тансаг хэрэглээ", hint: "нээх шаардлагагүй авсан зүйлс" },
  { label: "Урдаас захиалсан зүйл", hint: "" },
];

export const INCOME_REASONS: { label: string; hint: string }[] = [
  { label: "Цалин", hint: "" },
  { label: "Бусад", hint: "" },
];

export const REASON_KINDS = ["expense", "income"] as const;
export type ReasonKind = (typeof REASON_KINDS)[number];

export const REASON_MAX = 80;

export function cleanReasonName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim();
  if (!name || name.length > REASON_MAX) return null;
  return name;
}

export function isBuiltInReason(name: string) {
  const key = name.toLowerCase();
  return [...EXPENSE_REASONS, ...INCOME_REASONS].some((item) => item.label.toLowerCase() === key);
}
