'use client'

import Link from 'next/link'

export default function Orders() {
  return (
    <main className="min-h-screen bg-[#100E17] text-white px-4 sm:px-8 lg:px-12 py-6 w-full pb-28">
      {/* Header */}
      <header className="flex justify-between items-center mb-6 pb-4 border-b border-[#302A3A]">
        <div>
          <h1 className="text-2xl font-bold text-[#7B4FE0]">Pesanan Saya</h1>
          <p className="text-xs text-[#AAA1B8]">Foto jepretan yang sudah dibeli</p>
        </div>
      </header>

      {/* Empty State Pesanan */}
      <div className="text-center py-16 bg-[#181520] border border-[#302A3A] rounded-2xl p-6">
        <span className="text-5xl mb-4 block">🛒</span>
        <p className="text-base font-bold text-white mb-1">Belum Ada Pesanan</p>
        <p className="text-xs text-[#AAA1B8] max-w-xs mx-auto mb-6">
          Foto yang Anda unduh/beli akan tersimpan di sini.
        </p>

        <Link
          href="/"
          className="inline-block bg-[#7B4FE0] hover:bg-[#683ec9] text-white font-bold text-xs px-5 py-3 rounded-xl transition-all"
        >
          🔍 Cari Foto Sekarang
        </Link>
      </div>

      {/* BOTTOM NAVBAR RIDER */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#23143D]/95 backdrop-blur-md border-t border-[#302A3A] py-2 px-4">
        <div className="max-w-md mx-auto flex justify-around items-center">
          <Link
            href="/"
            className="flex flex-col items-center gap-1 text-xs font-bold text-[#9E8DBE] hover:text-white px-4 py-1.5 rounded-xl transition-all"
          >
            <span className="text-base">🏠</span>
            <span>Cari Foto</span>
          </Link>

          <Link
            href="/orders"
            className="flex flex-col items-center gap-1 text-xs font-bold text-white bg-[#7B4FE0] px-4 py-1.5 rounded-xl shadow-lg shadow-[#7B4FE0]/30"
          >
            <span className="text-base">🛒</span>
            <span>Pesanan</span>
          </Link>

          <Link
            href="/profile"
            className="flex flex-col items-center gap-1 text-xs font-bold text-[#9E8DBE] hover:text-white px-4 py-1.5 rounded-xl transition-all"
          >
            <span className="text-base">👤</span>
            <span>Profil</span>
          </Link>
        </div>
      </nav>
    </main>
  )
}