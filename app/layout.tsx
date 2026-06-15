import './globals.css'
import type { Metadata } from 'next'
import { ChunkLoadRecovery } from '@/components/ChunkLoadRecovery'

export const metadata: Metadata = {
  title: 'Havdolo - Jewish Music Vocal Remover',
  description: 'The first AI stem separator built specifically for Jewish music',
  icons: {
    icon: '/logo.svg',
  },
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
