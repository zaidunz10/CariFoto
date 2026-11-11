import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://cari-foto.vercel.app'),
  title: {
    default: 'Cari Foto Ciwidey | Hunting Foto & Session Photo Ciwidey',
    template: '%s | Cari Foto Ciwidey',
  },
  description:
    'Cari foto Ciwidey untuk hunting foto, session photo, wisata, keluarga, dan momen spesial di Ciwidey. Temukan foto dan booking sesi foto mudah di CariFoto.',
  keywords: [
    'cari foto ciwidey',
    'foto ciwidey',
    'hunting foto ciwidey',
    'session foto ciwidey',
    'jasa foto ciwidey',
    'fotografer ciwidey',
    'cari foto',
    'jasa hunting foto',
    'foto event',
    'session foto',
  ],
  openGraph: {
    title: 'Cari Foto Ciwidey | Hunting Foto & Session Photo Ciwidey',
    description:
      'Temukan sesi hunting foto, foto wisata, dan momen penting di Ciwidey hanya di CariFoto.',
    url: 'https://cari-foto.vercel.app',
    siteName: 'CariFoto',
    locale: 'id_ID',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Cari Foto Ciwidey | Hunting Foto & Session Photo Ciwidey',
    description:
      'Temukan sesi hunting foto, foto wisata, dan momen penting di Ciwidey hanya di CariFoto.',
  },
  alternates: {
    canonical: '/',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#100E17" />
      </head>
      <body className="bg-[#100E17] text-white antialiased min-h-screen selection:bg-[#7B4FE0] selection:text-white" suppressHydrationWarning>
        {children}
      </body>
    </html>
  )
}
