import Link from "next/link";
import { Suspense } from "react";
import { TravelDashboardBody, TravelDashboardSkeleton } from "./view";

export const metadata = {
  title: "Аяллын хяналт",
};

export default function TravelDashboardPage() {
  return (
    <main
      className="flex flex-1 flex-col bg-black text-white"
      style={{ fontFamily: "var(--font-manrope), system-ui, sans-serif" }}
    >
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-6 sm:py-10">
        <header className="mb-6 flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            Аяллын <span className="text-orange-400">хяналт</span>
          </h1>
          <Link href="/travel" className="text-sm font-medium text-zinc-400 hover:text-white">
            Тэмдэглэл
          </Link>
        </header>
        <Suspense fallback={<TravelDashboardSkeleton />}>
          <TravelDashboardBody />
        </Suspense>
      </div>
    </main>
  );
}
