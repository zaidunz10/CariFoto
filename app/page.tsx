import { Suspense } from "react";
import BottomNav from "@/components/BottomNav";
import HomeClient from "@/components/HomeClient";
import { fetchSessionsServer } from "@/lib/supabase-server";

async function HomeSessionsLoader() {
  const { sessions, error } = await fetchSessionsServer();
  return <HomeClient initialSessions={sessions} initialError={error} />;
}

function HomeLoadingFallback() {
  return (
    <main className="min-h-screen w-full bg-[#100E17] px-4 py-6 pb-28 text-white sm:px-8 lg:px-12">
      <div className="flex min-h-screen w-full flex-col">
        <header className="flex items-center justify-between border-b border-[#302A3A] pb-4">
          <div>
            <h1 className="text-2xl font-bold text-[#7B4FE0] sm:text-3xl">
              CariFoto
            </h1>
            <p className="text-xs text-[#AAA1B8] sm:text-sm">
              Temukan momen berkendaramu
            </p>
          </div>
        </header>

        <div className="my-6 rounded-2xl border border-[#302A3A] bg-[#181520] p-6 text-center text-xs text-[#AAA1B8]">
          Memuat daftar sesi hunting...
        </div>
      </div>

      <BottomNav active="home" />
    </main>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<HomeLoadingFallback />}>
      <HomeSessionsLoader />
    </Suspense>
  );
}
