import Link from "next/link";
import { Suspense } from "react";
import { DashboardBody, DashboardSkeleton } from "./view";

export const metadata = {
  title: "Хяналт",
};

export default function DashboardPage() {
  return (
    <main
      className="flex flex-1 flex-col bg-black text-white"
      style={{ fontFamily: "var(--font-manrope), system-ui, sans-serif" }}
    >
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-6 sm:py-10">
        <header className="mb-6 flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            Мөнгөний <span className="text-purple-400">хяналт</span>
          </h1>
          <Link href="/" className="text-sm font-medium text-zinc-400 hover:text-white">
            Тэмдэглэл
          </Link>
        </header>
        <Suspense fallback={<DashboardSkeleton />}>
          <DashboardBody />
        </Suspense>
      </div>
    </main>
  );
}
