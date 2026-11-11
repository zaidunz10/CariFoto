import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://cari-foto.vercel.app'),
  title: {
    default: 'CariFoto | Jasa Hunting Foto & Session Photo',
    template: '%s | CariFoto',
  },
  description:
    'CariFoto membantu kamu menemukan sesi hunting foto, foto event, dan momen penting dengan mudah dan cepat.',
  keywords: [
    'cari foto',
    'jasa hunting foto',
    'foto event',
    'session foto',
    'fotografer jakarta',
    'cari foto hunting',
  ],
  openGraph: {
    title: 'CariFoto | Jasa Hunting Foto & Session Photo',
    description:
      'Temukan sesi hunting foto, foto event, dan momen penting hanya di CariFoto.',
    url: 'https://cari-foto.vercel.app',
    siteName: 'CariFoto',
    locale: 'id_ID',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CariFoto | Jasa Hunting Foto & Session Photo',
    description:
      'Temukan sesi hunting foto, foto event, dan momen penting hanya di CariFoto.',
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
