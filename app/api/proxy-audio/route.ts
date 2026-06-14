import { NextRequest, NextResponse } from 'next/server'

// Allow up to 60 seconds for audio proxying (handles large files)
export const maxDuration = 60

// Proxy audio files to bypass CORS restrictions
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const url = searchParams.get('url')

    if (!url) {
      return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 })
    }

    // Validate that the URL is from LALAL.AI to prevent abuse
    if (!url.startsWith('https://www.lalal.ai/') && !url.includes('lalal.ai')) {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 403 })
    }

    // Get Range header from the client request (for seeking support)
    const rangeHeader = request.headers.get('range')
    
    // Fetch the audio file from LALAL.AI with range support
    const fetchHeaders: HeadersInit = {
      'User-Agent': 'Havdolo-Audio-Proxy',
    }
    
    if (rangeHeader) {
      fetchHeaders['Range'] = rangeHeader
    }

    const response = await fetch(url, {
      headers: fetchHeaders,
    })

    if (!response.ok) {
      console.error('Failed to fetch audio from LALAL.AI:', response.status)
      return NextResponse.json(
        { error: 'Failed to fetch audio' },
        { status: response.status }
      )
    }

    // Build response headers.
    //
    // IMPORTANT: use `private` (not `public`) for caching. Each stem (vocals /
    // no_vocals) is proxied via a distinct `?url=` value, but a *shared* CDN
    // cache (e.g. Netlify's) can collapse these — especially with Range
    // requests — and serve the first-fetched stem (vocals) for both players.
    // `private` keeps fast per-URL caching in the user's browser while
    // preventing any shared cache from storing and cross-serving the audio.
    const responseHeaders: HeadersInit = {
      'Content-Type': response.headers.get('Content-Type') || 'audio/mpeg',
      'Cache-Control': 'private, max-age=31536000, immutable',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Range',
      'Accept-Ranges': 'bytes',
      Vary: 'Range',
    }

    // Forward Content-Length and Content-Range if present (for range requests)
    const contentLength = response.headers.get('Content-Length')
    const contentRange = response.headers.get('Content-Range')

    if (contentLength) {
      responseHeaders['Content-Length'] = contentLength
    }

    if (contentRange) {
      responseHeaders['Content-Range'] = contentRange
    }

    // Stream the body straight through instead of buffering the whole file into
    // memory — avoids serverless response-size limits and is faster to first byte.
    return new NextResponse(response.body, {
      status: rangeHeader && contentRange ? 206 : 200,
      headers: responseHeaders,
    })
  } catch (error) {
    console.error('Audio proxy error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Handle OPTIONS requests for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Range',
    },
  })
}
