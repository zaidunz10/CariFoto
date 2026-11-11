
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthCallback() {
  const router = useRouter()
  const [message, setMessage] = useState('Memverifikasi akun Google...')

  useEffect(() => {
    let active = true

    async function verifyLogin() {
      const params = new URLSearchParams(window.location.search)
      const nextPath = params.get('next') || '/'

      if (!supabase) {
        router.replace('/')
        return
      }

      const { data, error } = await supabase.auth.getSession()

      if (!active) return

      if (error || !data.session) {
        setMessage('Login gagal. Silakan coba kembali.')
        router.replace('/')
        return
      }

      setMessage('Login berhasil! Mengalihkan...')
      router.replace(nextPath)
    }

    verifyLogin()

    return () => {
      active = false
    }
  }, [router])

  return (
    <main className="min-h-screen bg-[#100E17] flex items-center justify-center text-white">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-[#302A3A] border-t-[#7B4FE0] mx-auto mb-4" />
        <p className="text-sm text-[#AAA1B8]">{message}</p>
      </div>
    </main>
  )
}
