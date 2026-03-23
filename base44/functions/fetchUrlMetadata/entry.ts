/**
 * fetchUrlMetadata - Backend function to extract metadata (title, thumbnail) from URLs
 * 
 * Supports:
 * - YouTube (oEmbed API)
 * - Vimeo (oEmbed API)
 * - Spotify (oEmbed API)
 * - PDF links (extracts filename as title)
 * - Generic URLs (OpenGraph meta tags)
 * 
 * Returns: { title, thumbnail, type, error? }
 * 
 * Branch: Segment Resource Links Enhancement
 * Parent: Live Director improvements
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { url } = await req.json();

    if (!url || typeof url !== 'string') {
      return Response.json({ error: 'URL is required' }, { status: 400 });
    }

    // Validate URL format
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch {
      return Response.json({ 
        title: null, 
        thumbnail: null, 
        type: 'invalid',
        error: 'Invalid URL format'
      });
    }

    // H-SEC-4 FIX (2026-02-20): SSRF guard — block private/internal IPs and non-HTTP schemes.
    const scheme = parsedUrl.protocol;
    if (scheme !== 'http:' && scheme !== 'https:') {
      return Response.json({ title: null, thumbnail: null, type: 'blocked', error: 'Only HTTP(S) URLs are allowed' });
    }
    const hostname = parsedUrl.hostname.toLowerCase();
    // Block private IPs, loopback, link-local, metadata endpoints
    const blockedPatterns = [
      /^localhost$/i,
      /^127\./,
      /^10\./,
      /^172\.(1[6-9]|2\d|3[01])\./,
      /^192\.168\./,
      /^169\.254\./,           // AWS/cloud metadata link-local
      /^0\./,                   // 0.0.0.0 range
      /^\[::1\]$/,             // IPv6 loopback
      /^\[fc/i, /^\[fd/i,     // IPv6 private
      /^\[fe80/i,              // IPv6 link-local
      /^metadata\.google\.internal$/i,
    ];
    if (blockedPatterns.some(p => p.test(hostname))) {
      return Response.json({ title: null, thumbnail: null, type: 'blocked', error: 'Private/internal URLs are not allowed' });
    }

    // YouTube detection
    if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
      return Response.json(await fetchYouTubeMetadata(url));
    }

    // Vimeo detection
    if (hostname.includes('vimeo.com')) {
      return Response.json(await fetchVimeoMetadata(url));
    }

    // Spotify detection
    if (hostname.includes('spotify.com')) {
      return Response.json(await fetchSpotifyMetadata(url));
    }

    // PDF detection
    if (parsedUrl.pathname.toLowerCase().endsWith('.pdf')) {
      return Response.json(extractPdfMetadata(url));
    }

    // Generic OpenGraph fallback
    return Response.json(await fetchOpenGraphMetadata(url));

  } catch (error) {
    console.error('fetchUrlMetadata error:', error);
    return Response.json({ 
      title: null, 
      thumbnail: null, 
      type: 'error',
      error: error.message 
    }, { status: 500 });
  }
});

/**
 * Fetch YouTube metadata via oEmbed API
 */
async function fetchYouTubeMetadata(url) {
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const response = await fetch(oembedUrl);
    
    if (!response.ok) {
      return { title: null, thumbnail: null, type: 'youtube', error: 'YouTube oEmbed failed' };
    }

    const data = await response.json();
    
    // Extract video ID for high-res thumbnail
    let thumbnail = data.thumbnail_url;
    const videoIdMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\?\/]+)/);
    if (videoIdMatch) {
      // Use maxresdefault for better quality, fallback handled by browser
      thumbnail = `https://img.youtube.com/vi/${videoIdMatch[1]}/maxresdefault.jpg`;
    }

    return {
      title: data.title || null,
      thumbnail,
      type: 'youtube',
      fetched_at: new Date().toISOString()
    };
  } catch (error) {
    return { title: null, thumbnail: null, type: 'youtube', error: error.message };
  }
}

/**
 * Fetch Vimeo metadata via oEmbed API
 */
async function fetchVimeoMetadata(url) {
  try {
    const oembedUrl = `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`;
    const response = await fetch(oembedUrl);
    
    if (!response.ok) {
      return { title: null, thumbnail: null, type: 'vimeo', error: 'Vimeo oEmbed failed' };
    }

    const data = await response.json();

    return {
      title: data.title || null,
      thumbnail: data.thumbnail_url || null,
      type: 'vimeo',
      fetched_at: new Date().toISOString()
    };
  } catch (error) {
    return { title: null, thumbnail: null, type: 'vimeo', error: error.message };
  }
}

/**
 * Fetch Spotify metadata via oEmbed API
 */
async function fetchSpotifyMetadata(url) {
  try {
    const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`;
    const response = await fetch(oembedUrl);
    
    if (!response.ok) {
      return { title: null, thumbnail: null, type: 'spotify', error: 'Spotify oEmbed failed' };
    }

    const data = await response.json();

    return {
      title: data.title || null,
      thumbnail: data.thumbnail_url || null,
      type: 'spotify',
      fetched_at: new Date().toISOString()
    };
  } catch (error) {
    return { title: null, thumbnail: null, type: 'spotify', error: error.message };
  }
}

/**
 * Extract PDF metadata from filename
 */
function extractPdfMetadata(url) {
  try {
    const parsedUrl = new URL(url);
    const pathname = parsedUrl.pathname;
    const filename = pathname.split('/').pop() || 'Document';
    // Remove .pdf extension and decode URI
    const title = decodeURIComponent(filename.replace(/\.pdf$/i, ''));

    return {
      title: title || 'PDF Document',
      thumbnail: null, // PDFs don't have thumbnails
      type: 'pdf',
      fetched_at: new Date().toISOString()
    };
  } catch {
    return { title: 'PDF Document', thumbnail: null, type: 'pdf' };
  }
}

/**
 * Fetch OpenGraph metadata for generic URLs
 */
async function fetchOpenGraphMetadata(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PDVEventPro/1.0; +https://pdveventpro.com)'
      }
    });

    if (!response.ok) {
      return { title: null, thumbnail: null, type: 'generic', error: 'Fetch failed' };
    }

    const html = await response.text();
    
    // Extract OpenGraph title
    let title = null;
    const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
    if (ogTitleMatch) {
      title = ogTitleMatch[1];
    } else {
      // Fallback to <title> tag
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch) {
        title = titleMatch[1].trim();
      }
    }

    // Extract OpenGraph image
    let thumbnail = null;
    const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
    if (ogImageMatch) {
      thumbnail = ogImageMatch[1];
      // Handle relative URLs
      if (thumbnail && !thumbnail.startsWith('http')) {
        const baseUrl = new URL(url);
        thumbnail = new URL(thumbnail, baseUrl.origin).href;
      }
    }

    return {
      title: title || null,
      thumbnail: thumbnail || null,
      type: 'generic',
      fetched_at: new Date().toISOString()
    };
  } catch (error) {
    return { title: null, thumbnail: null, type: 'generic', error: error.message };
  }
}