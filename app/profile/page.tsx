"use client";

import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import BottomNav from "@/components/BottomNav";
import ConfirmDialog from "@/components/ConfirmDialog";
import { supabase } from "@/lib/supabase";

export default function Profile() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState<boolean>(() =>
    Boolean(supabase),
  );

  const [infoDialog, setInfoDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
  }>({
    open: false,
    title: "",
    description: "",
  });

  useEffect(() => {
    const client = supabase;
    if (!client) return;

    let isMounted = true;

    client.auth
      .getUser()
      .then(({ data }) => {
        if (isMounted) setUser(data.user ?? null);
      })
      .finally(() => {
        if (isMounted) setIsLoadingUser(false);
      });

    const { data: authListener } = client.auth.onAuthStateChange(
      (_event, session) => {
        if (isMounted) {
          setUser(session?.user || null);
          setIsLoadingUser(false);
        }
      },
    );

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const userName =
    (user?.user_metadata?.full_name as string | undefined) || "Guest";
  const userEmail = user?.email || "Guest@carifoto.id";
  const photoUrl =
    (user?.user_metadata?.avatar_url as string | undefined) || "";
  const initials =
    userName
      .trim()
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("") || "RD";

  const isGuest = !user || !user.id || String(user.id).startsWith("guest");
  const purchasedCount = 0;

  async function handleGoogleLogin() {
    if (!supabase) {
      setInfoDialog({
        open: true,
        title: "Supabase Belum Dikonfigurasi",
        description:
          "Isi NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY terlebih dahulu.",
      });
      return;
    }

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/`,
          queryParams: {
            prompt: "select_account",
          },
        },
      });
      if (error) throw error;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Terjadi kesalahan tidak dikenal.";
      setInfoDialog({
        open: true,
        title: "Gagal Login Google",
        description: message,
      });
    }
  }

  async function handleLogout() {
    if (!supabase) {
      setInfoDialog({
        open: true,
        title: "Supabase Belum Dikonfigurasi",
        description: "Konfigurasi Supabase belum tersedia.",
      });
      return;
    }

    await supabase.auth.signOut();
    setUser(null);
    setInfoDialog({
      open: true,
      title: "Berhasil Keluar",
      description: "Kamu sudah keluar dari akun.",
    });
  }

  return (
    <main className="min-h-screen w-full bg-[#100E17] px-4 py-6 pb-28 text-white sm:px-8 lg:px-12">
      {isLoadingUser ? (
        <div className="mx-auto flex min-h-screen max-w-5xl items-center justify-center">
          <div className="w-full max-w-md rounded-2xl border border-[#302A3A] bg-[#181520] p-6 text-center text-sm text-[#AAA1B8] shadow-xl">
            Memuat profil...
          </div>
        </div>
      ) : (
        <div className="mx-auto flex min-h-screen max-w-5xl flex-col items-center pt-2">
          <header className="flex w-full max-w-5xl items-center justify-between border-b border-[#302A3A] pb-4">
            <button
              type="button"
              onClick={() => {
                if (window.history.length > 1) {
                  router.back();
                } else {
                  router.push("/");
                }
              }}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[#302A3A] bg-[#181520] text-lg text-white transition hover:border-[#7B4FE0]"
              aria-label="Kembali"
            >
              ←
            </button>
            <h1 className="text-xl font-bold text-white">Profil Rider</h1>
            <div className="w-9" />
          </header>

          <div className="mt-6 flex w-full max-w-md flex-col items-center">
            <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border-4 border-[#302A3A] bg-[#23143D] shadow-lg shadow-[#7B4FE0]/25">
              {photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photoUrl}
                  alt="Foto Profil"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-3xl font-bold text-[#D9CBFF]">
                  {initials}
                </span>
              )}
            </div>

            <h2 className="mt-4 text-xl font-bold text-white">{userName}</h2>

            <div className="mt-2 rounded-full border border-[#7B4FE0]/40 bg-[#7B4FE0]/15 px-3 py-1 text-xs font-medium text-[#D9CBFF]">
              {userEmail}
            </div>

            <div className="mt-6 w-full rounded-2xl border border-[#302A3A] bg-[#181520] p-4 shadow-xl">
              <div className="flex items-center justify-around">
                <div className="text-center">
                  <div className="text-lg font-bold text-[#7B4FE0]">
                    {purchasedCount}
                  </div>
                  <div className="text-[11px] text-[#AAA1B8]">
                    Foto Koleksi Dibeli
                  </div>
                </div>

                <div className="h-9 w-px bg-[#302A3A]" />

                <div className="text-center">
                  <div
                    className={`text-lg font-bold ${isGuest ? "text-[#D9CBFF]" : "text-emerald-400"}`}
                  >
                    {isGuest ? "Mode Tamu" : "Aktif"}
                  </div>
                  <div className="text-[11px] text-[#AAA1B8]">Status Akun</div>
                </div>
              </div>
            </div>

            <div className="mt-5 w-full rounded-2xl border border-[#302A3A] bg-[#181520] p-2 shadow-xl">
              <Link
                href="/orders"
                className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition hover:bg-[#100E17]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#100E17] text-[#7B4FE0]">
                    🛒
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">
                      Pesanan Saya
                    </div>
                    <div className="text-[11px] text-[#AAA1B8]">
                      Lihat foto jepretan yang sudah dibeli
                    </div>
                  </div>
                </div>
                <span className="text-lg text-[#AAA1B8]">›</span>
              </Link>

              <div className="mx-4 border-t border-[#302A3A]" />

              <button
                type="button"
                onClick={() =>
                  setInfoDialog({
                    open: true,
                    title: "Pusat Bantuan & FAQ",
                    description:
                      "Kamu dapat mencari foto lewat plat nomor, lokasi, tanggal, atau filter model motor & jaket. Setelah menemukan foto, kamu bisa langsung unduh foto HD atau hubungi fotografer lewat WhatsApp.",
                  })
                }
                className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition hover:bg-[#100E17]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#100E17] text-[#7B4FE0]">
                    ℹ️
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">
                      Pusat Bantuan &amp; FAQ
                    </div>
                    <div className="text-[11px] text-[#AAA1B8]">
                      Cara cari foto, hubungi fotografer &amp; download HD
                    </div>
                  </div>
                </div>
                <span className="text-lg text-[#AAA1B8]">›</span>
              </button>

              <div className="mx-4 border-t border-[#302A3A]" />

              <button
                type="button"
                onClick={() =>
                  setInfoDialog({
                    open: true,
                    title: "Syarat & Ketentuan Rider",
                    description:
                      "Foto yang tampil di CariFoto dipublikasikan oleh fotografer komunitas untuk rider. Harap hormati hak cipta fotografer sesuai ketentuan masing-masing sesi.",
                  })
                }
                className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition hover:bg-[#100E17]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#100E17] text-[#7B4FE0]">
                    🔒
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">
                      Syarat &amp; Ketentuan Rider
                    </div>
                    <div className="text-[11px] text-[#AAA1B8]">
                      Kebijakan privasi &amp; hak cipta foto
                    </div>
                  </div>
                </div>
                <span className="text-lg text-[#AAA1B8]">›</span>
              </button>
            </div>

            <div className="mt-7 w-full">
              {isGuest ? (
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#7B4FE0] text-base font-bold text-white shadow-lg shadow-[#7B4FE0]/25 transition hover:bg-[#683ec9]"
                >
                  <span>🔐</span>
                  <span>Masuk dengan Google</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-rose-600 text-base font-bold text-white transition hover:bg-rose-500"
                >
                  <span>↩</span>
                  <span>Keluar Akun</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <BottomNav active="profile" />

      <ConfirmDialog
        open={infoDialog.open}
        title={infoDialog.title}
        description={infoDialog.description}
        confirmLabel="Tutup"
        hideCancel
        onConfirm={() => {}}
        onClose={() => setInfoDialog((prev) => ({ ...prev, open: false }))}
      />
    </main>
  );
}
