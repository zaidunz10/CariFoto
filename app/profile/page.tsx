'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function Profile() {
  const [user, setUser] = useState<any>(null)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    setIsReady(true)

    const client = supabase
    if (!client) {
      setUser(null)
      return
    }

    let isMounted = true

    client.auth.getUser().then(({ data }) => {
      if (isMounted) setUser(data.user ?? null)
    })

    const { data: authListener } = client.auth.onAuthStateChange((_event, session) => {
      if (isMounted) setUser(session?.user || null)
    })

    return () => {
      isMounted = false
      authListener.subscription.unsubscribe()
    }
  }, [])

  const userName = user?.user_metadata?.full_name || 'Guest'
  const userEmail = user?.email || 'Guest@carifoto.id'
  const photoUrl = user?.user_metadata?.avatar_url || ''
  const initials = userName
    .trim()
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part: string) => part[0]?.toUpperCase() || '')
    .join('') || 'RD'

  const isGuest = !user || !user.id || String(user.id).startsWith('guest')
  const purchasedCount = 0

  async function handleGoogleLogin() {
    if (!supabase) {
      alert('Supabase belum dikonfigurasi. Isi NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY.')
      return
    }

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/`,
          queryParams: {
            prompt: 'select_account',
          },
        }
      })
      if (error) throw error
    } catch (err: any) {
      alert(`Gagal login Google: ${err.message}`)
    }
  }

  async function handleLogout() {
    if (!supabase) {
      alert('Supabase belum dikonfigurasi.')
      return
    }

    await supabase.auth.signOut()
    setUser(null)
    alert('Berhasil keluar akun.')
  }

  const handleOpenHelp = () => {
    alert('Bantuan: Pembayaran via QRIS otomatis terverifikasi & foto HD langsung bisa didownload.')
  }

  const handleOpenTerms = () => {
    alert('Syarat: Foto dipublikasikan oleh Fotografer terverifikasi untuk komunitas Rider.')
  }

  return (
    <main className="min-h-screen bg-[#F4F7FB] text-[#1E293B] px-4 sm:px-8 lg:px-12 py-6 w-full pb-28">
      {!isReady ? (
        <div className="mx-auto flex min-h-screen max-w-5xl items-center justify-center">
          <div className="w-full max-w-md rounded-2xl border border-[#E2E8F0] bg-white p-6 text-center text-sm text-[#64748B] shadow-sm">
            Memuat profil...
          </div>
        </div>
      ) : (
        <div className="mx-auto flex min-h-screen max-w-5xl flex-col items-center pt-2">
          <header className="flex w-full max-w-5xl items-center justify-between pb-4">
            <div className="flex items-center gap-2 text-[#1E293B]">
              <button
                onClick={() => window.history.back()}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E2E8F0] bg-white text-xl text-[#1E293B]"
                aria-label="Kembali"
              >
                ←
              </button>
            </div>
            <h1 className="text-xl font-bold text-[#1E293B]">Profil Rider</h1>
            <div className="w-9" />
          </header>

          <div className="flex w-full max-w-md flex-col items-center pt-2">
            <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-[#D6C7FF] shadow-lg shadow-[#7B4FE0]/20">
              {photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoUrl} alt="Profile Photo" className="h-full w-full object-cover" />
              ) : (
                <span className="text-3xl font-bold text-[#23143D]">{initials}</span>
              )}
            </div>

            <h2 className="mt-4 text-[20px] font-bold text-[#1E293B]">{userName}</h2>

            <div className="mt-2 rounded-full bg-[#E8F2FF] px-3 py-1 text-[12px] font-medium text-[#7B4FE0]">
              {userEmail}
            </div>

            <div className="mt-6 w-full rounded-[20px] bg-white p-4 shadow-sm ring-1 ring-[#E2E8F0]">
              <div className="flex items-center justify-around">
                <div className="text-center">
                  <div className="text-[18px] font-bold text-[#7B4FE0]">{purchasedCount}</div>
                  <div className="text-[11px] text-[#64748B]">Foto Koleksi Dibeli</div>
                </div>

                <div className="h-9 w-px bg-[#E2E8F0]" />

                <div className="text-center">
                  <div className={`text-[18px] font-bold ${isGuest ? 'text-[#7B4FE0]' : 'text-[#22C55E]'}`}>
                    {isGuest ? 'Mode Tamu' : 'Aktif'}
                  </div>
                  <div className="text-[11px] text-[#64748B]">Status Akun</div>
                </div>
              </div>
            </div>

            <div className="mt-5 w-full rounded-[20px] bg-white p-2 shadow-sm ring-1 ring-[#E2E8F0]">
              <button
                onClick={() => (window.location.href = '/orders')}
                className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition hover:bg-[#F8FAFC]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F1F5F9] text-[#7B4FE0]">🛒</div>
                  <div>
                    <div className="text-sm font-bold text-[#1E293B]">Pesanan Saya</div>
                    <div className="text-[11px] text-[#64748B]">Lihat foto jepretan yang sudah dibeli</div>
                  </div>
                </div>
                <span className="text-lg text-[#94A3B8]">›</span>
              </button>

              <div className="mx-4 border-t border-[#F1F5F9]" />

              <button
                onClick={handleOpenHelp}
                className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition hover:bg-[#F8FAFC]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F1F5F9] text-[#7B4FE0]">ℹ️</div>
                  <div>
                    <div className="text-sm font-bold text-[#1E293B]">Pusat Bantuan & FAQ</div>
                    <div className="text-[11px] text-[#64748B]">Cara cari foto, bayar QRIS & download HD</div>
                  </div>
                </div>
                <span className="text-lg text-[#94A3B8]">›</span>
              </button>

              <div className="mx-4 border-t border-[#F1F5F9]" />

              <button
                onClick={handleOpenTerms}
                className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition hover:bg-[#F8FAFC]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F1F5F9] text-[#7B4FE0]">🔒</div>
                  <div>
                    <div className="text-sm font-bold text-[#1E293B]">Syarat & Ketentuan Rider</div>
                    <div className="text-[11px] text-[#64748B]">Kebijakan privasi & hak cipta foto</div>
                  </div>
                </div>
                <span className="text-lg text-[#94A3B8]">›</span>
              </button>
            </div>

            <div className="mt-7 w-full">
              {isGuest ? (
                <button
                  onClick={handleGoogleLogin}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#7B4FE0] text-base font-bold text-white shadow-lg shadow-[#7B4FE0]/25"
                >
                  <span>🔐</span>
                  <span>Masuk dengan Google</span>
                </button>
              ) : (
                <button
                  onClick={handleLogout}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#EF4444] text-base font-bold text-white"
                >
                  <span>↩</span>
                  <span>Keluar Akun</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#23143D]/95 backdrop-blur-md border-t border-[#302A3A] py-2 px-4">
        <div className="mx-auto flex max-w-md items-center justify-around">
          <Link href="/" className="flex flex-col items-center gap-1 rounded-xl px-4 py-1.5 text-xs font-bold text-[#9E8DBE] transition-all hover:text-white">
            <span className="text-base">🏠</span>
            <span>Cari Foto</span>
          </Link>

          <Link href="/orders" className="flex flex-col items-center gap-1 rounded-xl px-4 py-1.5 text-xs font-bold text-[#9E8DBE] transition-all hover:text-white">
            <span className="text-base">🛒</span>
            <span>Pesanan</span>
          </Link>

          <Link href="/profile" className="flex flex-col items-center gap-1 rounded-xl bg-[#7B4FE0] px-4 py-1.5 text-xs font-bold text-white shadow-lg shadow-[#7B4FE0]/30">
            <span className="text-base">👤</span>
            <span>Profil</span>
          </Link>
        </div>
      </nav>
    </main>
  )
}