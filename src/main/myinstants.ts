import { execFile } from 'child_process'
import type { StoreSearchResult } from '../shared/types'

// MyInstants has no official public API, so this scrapes its search-results HTML directly.
// The markup for each hit is consistently:
//   <button onclick="play('/media/sounds/<file>.mp3', 'loader-<n>', '<slug>')" ...></button>
//   ...
//   <a href="/en/instant/<slug>/" class="instant-link ...">Title</a>
// Captured empirically against a real search response - see the search result's `onclick`
// argument order (mp3 path, loader element id, slug) and the title text immediately following.
const RESULT_PATTERN =
  /onclick="play\('([^']+)',\s*'[^']*',\s*'[^']*'\)"[\s\S]{0,400}?class="instant-link[^"]*">([^<]+)<\/a>/g

const BASE_URL = 'https://www.myinstants.com'
const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
const REQUEST_TIMEOUT_MS = 15000
const MAX_BUFFER_BYTES = 20 * 1024 * 1024

// Requests go through curl rather than Node's built-in fetch: myinstants.com sits behind
// Cloudflare bot-management, and empirically Node's fetch (undici) gets served a "Just a
// moment..." JS challenge (HTTP 403, cf-mitigated: challenge) on *every* request even with an
// identical User-Agent header, while curl with the same UA passes every time on the same URL -
// a TLS/HTTP2 fingerprinting difference between the two clients, not anything header-based. The
// app already shells out to a system binary for exactly this class of problem (pactl, in
// audio.ts), so this follows the same established pattern rather than fighting undici's fingerprint.
function curl(url: string, binary: boolean): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    execFile(
      'curl',
      ['-sL', '-f', '-A', USER_AGENT, url],
      { timeout: REQUEST_TIMEOUT_MS, maxBuffer: MAX_BUFFER_BYTES, encoding: binary ? 'buffer' : 'utf8' },
      (error, stdout) => {
        if (error) {
          const err = error as NodeJS.ErrnoException
          if (err.code === 'ENOENT') {
            reject(new Error('curl is required for the Sound Store but was not found on this system.'))
          } else {
            reject(new Error("Couldn't reach MyInstants - it may be temporarily blocking requests."))
          }
          return
        }
        resolve(binary ? (stdout as unknown as Buffer) : Buffer.from(stdout as string, 'utf8'))
      }
    )
  })
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&#x27;/g, "'")
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

export async function searchMyInstants(query: string): Promise<StoreSearchResult[]> {
  const trimmed = query.trim()
  if (!trimmed) return []

  const url = `${BASE_URL}/en/search/?name=${encodeURIComponent(trimmed)}`
  const html = (await curl(url, false)).toString('utf8')

  const seen = new Set<string>()
  const results: StoreSearchResult[] = []
  for (const match of html.matchAll(RESULT_PATTERN)) {
    const mp3Path = match[1]
    if (seen.has(mp3Path)) continue
    seen.add(mp3Path)
    results.push({ mp3Path, title: decodeEntities(match[2].trim()) })
  }
  return results
}

/** Fetches the raw mp3 bytes for a result's `mp3Path`. Only ever called with a path this
 *  module itself produced via searchMyInstants, but validated anyway since it crosses the
 *  untrusted renderer via IPC first - a sandboxed renderer could otherwise be made to pass an
 *  arbitrary path and turn this into an open fetch proxy off of myinstants.com's origin. */
export async function fetchMyInstantsAudio(mp3Path: string): Promise<Buffer> {
  if (!mp3Path.startsWith('/media/sounds/')) throw new Error('Invalid MyInstants sound path')
  return curl(`${BASE_URL}${mp3Path}`, true)
}
