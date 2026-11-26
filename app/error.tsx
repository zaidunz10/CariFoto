"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function ErrorPage({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  const message =
    error instanceof Error && error.message
      ? error.message
      : "Terjadi kesalahan tak terduga saat memuat halaman.";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#100E17] px-4 text-white">
      <div className="w-full max-w-md rounded-2xl border border-[#302A3A] bg-[#181520] p-6 text-center shadow-2xl">
        <span className="mb-3 block text-4xl">⚠️</span>
        <h1 className="text-lg font-bold text-white">Terjadi Kesalahan</h1>
        <p className="mt-2 text-xs leading-relaxed text-[#AAA1B8] sm:text-sm">
          {message}
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => retry()}
            className="rounded-xl bg-[#7B4FE0] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#683ec9]"
          >
            Coba Lagi
          </button>
          <Link
            href="/"
            className="rounded-xl border border-[#302A3A] bg-[#100E17] px-4 py-2.5 text-xs font-bold text-[#AAA1B8] transition hover:border-[#7B4FE0] hover:text-white"
          >
            Kembali ke Beranda
          </Link>
        </div>
      </div>
    </main>
  );
}
