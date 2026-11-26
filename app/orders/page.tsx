"use client";

import Link from "next/link";
import BottomNav from "@/components/BottomNav";

export default function Orders() {
  return (
    <main className="min-h-screen w-full bg-[#100E17] px-4 py-6 pb-28 text-white sm:px-8 lg:px-12">
      {/* Header */}
      <header className="mb-6 flex items-center justify-between border-b border-[#302A3A] pb-4">
        <div>
          <h1 className="text-2xl font-bold text-[#7B4FE0]">Pesanan Saya</h1>
          <p className="text-xs text-[#AAA1B8]">
            Foto jepretan yang sudah dibeli
          </p>
        </div>
      </header>

      {/* Empty State Pesanan */}
      <div className="rounded-2xl border border-[#302A3A] bg-[#181520] p-6 py-16 text-center">
        <span className="mb-4 block text-5xl">🛒</span>
        <p className="mb-1 text-base font-bold text-white">Belum Ada Pesanan</p>
        <p className="mx-auto mb-6 max-w-xs text-xs text-[#AAA1B8]">
          Foto yang Anda unduh/beli akan tersimpan di sini.
        </p>

        <Link
          href="/"
          className="inline-block rounded-xl bg-[#7B4FE0] px-5 py-3 text-xs font-bold text-white transition-all hover:bg-[#683ec9]"
        >
          🔍 Cari Foto Sekarang
        </Link>
      </div>

      <BottomNav active="orders" />
    </main>
  );
}
