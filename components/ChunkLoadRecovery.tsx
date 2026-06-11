'use client'

import { useEffect } from 'react'

const RELOAD_KEY = 'havdolo_chunk_reload_once'

export function ChunkLoadRecovery() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      const message = event?.message || ''
      if (!message.includes('ChunkLoadError') && !message.includes('Loading chunk')) {
        return
      }

      // Reload only once to avoid loops.
      if (sessionStorage.getItem(RELOAD_KEY) === '1') return
      sessionStorage.setItem(RELOAD_KEY, '1')
      window.location.reload()
    }

    window.addEventListener('error', onError)
    return () => window.removeEventListener('error', onError)
  }, [])

  return null
}
