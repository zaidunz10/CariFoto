import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'CariFoto Rider - Temukan Momen Berkendaramu',
  description: 'Cari & Beli Foto Jepretan Jalananmu secara Instan',
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