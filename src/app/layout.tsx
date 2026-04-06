import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Hackathon Radar — Discover Builder Programs & Hackathons',
  description:
    'Real-time intelligence dashboard that discovers hackathons and builder programs by mining GitHub repositories. Filter by ecosystem, type, and deadline.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      </head>
      <body>{children}</body>
    </html>
  )
}
