import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://cari-foto.vercel.app'),
  title: {
    default: 'Cari Foto Ciwidey | Sunmori Ciwidey | Hunting Foto & Session Photo',
    template: '%s | Cari Foto Ciwidey',
  },
  description:
    'Cari foto Ciwidey, sunmori Ciwidey, hunting foto Ciwidey, dan session photo di Ciwidey. Temukan lokasi foto, momen wisata, dan booking sesi foto di CariFoto.',
  keywords: [
    'cari foto ciwidey',
    'foto ciwidey',
    'sunmori ciwidey',
    'hunting foto ciwidey',
    'session foto ciwidey',
    'jasa foto ciwidey',
    'fotografer ciwidey',
    'sunmori foto ciwidey',
    'tempat foto ciwidey',
    'wisata foto ciwidey',
    'cari foto',
    'hunting foto',
    'session photo',
    'foto wisata',
    'foto event',
  ],
  openGraph: {
    title: 'Cari Foto Ciwidey | Sunmori Ciwidey | Hunting Foto & Session Photo',
    description:
      'Cari foto Ciwidey, sunmori Ciwidey, dan session photo yang cocok untuk momen wisata, keluarga, serta aktivitas outdoor di Ciwidey.',
    url: 'https://cari-foto.vercel.app',
    siteName: 'CariFoto',
    locale: 'id_ID',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Cari Foto Ciwidey | Sunmori Ciwidey | Hunting Foto & Session Photo',
    description:
      'Cari foto Ciwidey, sunmori Ciwidey, dan session photo yang cocok untuk momen wisata, keluarga, serta aktivitas outdoor di Ciwidey.',
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
