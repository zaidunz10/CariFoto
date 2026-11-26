import Link from "next/link";

export default function SessionNotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#100E17] px-4 text-white">
      <div className="w-full max-w-md rounded-2xl border border-[#302A3A] bg-[#181520] p-6 text-center shadow-2xl">
        <span className="mb-3 block text-4xl">📁</span>
        <h1 className="text-lg font-bold text-white">
          Sesi Foto Tidak Ditemukan
        </h1>
        <p className="mt-2 text-xs leading-relaxed text-[#AAA1B8] sm:text-sm">
          Folder sesi hunting yang kamu buka tidak ditemukan atau sudah dihapus.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-xl bg-[#7B4FE0] px-5 py-2.5 text-xs font-bold text-white transition hover:bg-[#683ec9]"
        >
          🔍 Cari Sesi Lainnya
        </Link>
      </div>
    </main>
  );
}
