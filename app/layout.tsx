import './globals.css'
import type { Metadata, Viewport } from 'next'
import { ChunkLoadRecovery } from '@/components/ChunkLoadRecovery'

export const metadata: Metadata = {
  title: 'Havdolo - Jewish Music Vocal Remover',
  description: 'The first AI stem separator built specifically for Jewish music',
  icons: {
    icon: '/logo.svg',
  },
}

export const viewport: Viewport = {
  themeColor: '#0e0e0e',
  width: 'device-width',
  initialScale: 1,
  // Lets the background extend under the notch/home indicator so our
  // safe-area padding can take over for a clean edge-to-edge look.
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <ChunkLoadRecovery />
        {children}
      </body>
    </html>
  )
}
