#!/usr/bin/env node
// CI smoke test for the web /_next/image optimizer contract the app relies on
// (lib/optimized-image.ts). Fails loudly if the web side ever changes the
// width whitelist, the q=75 lock, or webp content negotiation.
//
// Usage:
//   node scripts/check-image-optimizer.mjs
//   BASE=http://localhost:3000 node scripts/check-image-optimizer.mjs
//
// Optional env:
//   BASE                            optimizer host (default https://mandybubbletea.com)
//   EXPO_PUBLIC_SITE_ACCESS_APP_KEY sent to /api/catalog to fetch a live image URL

const BASE = process.env.BASE ?? 'https://mandybubbletea.com'
const APP_KEY = process.env.EXPO_PUBLIC_SITE_ACCESS_APP_KEY

// Known-good production catalog image; used if the catalog fetch fails so the
// script still exercises the optimizer itself.
const FALLBACK_IMAGE =
  'https://items-images-production.s3.us-west-2.amazonaws.com/files/ccd6c37f1157494ebdbfb66f91e6b5251711b0a6/original.png'

// Must mirror SQUARE_IMAGE_HEADERS in lib/optimized-image.ts.
const ACCEPT = 'image/webp,image/*;q=0.8,*/*;q=0.5'

// Tiers the app actually uses (IMG_THUMB, IMG_HERO) plus one mid tier.
const TIERS = [384, 640, 1080]

async function liveImageUrl() {
  try {
    const headers = APP_KEY ? { 'x-mbt-app-key': APP_KEY } : {}
    const res = await fetch(`${BASE}/api/catalog`, { headers })
    if (!res.ok) throw new Error(`catalog ${res.status}`)
    const data = await res.json()
    const url = (data.items ?? []).find((it) => it.imageUrl)?.imageUrl
    if (!url) throw new Error('catalog has no imageUrl')
    return { url, source: 'live catalog' }
  } catch (e) {
    console.warn(`! catalog fetch failed (${e.message}); using fallback image URL`)
    return { url: FALLBACK_IMAGE, source: 'fallback constant' }
  }
}

function optimizerUrl(imageUrl, w) {
  return `${BASE}/_next/image?url=${encodeURIComponent(imageUrl)}&w=${w}&q=75`
}

async function checkTier(imageUrl, w) {
  const target = optimizerUrl(imageUrl, w)
  const res = await fetch(target, { headers: { Accept: ACCEPT } })
  const type = res.headers.get('content-type') ?? ''
  const bytes = (await res.arrayBuffer()).byteLength
  const ok = res.status === 200 && type.includes('image/webp')
  const mark = ok ? 'ok' : 'FAIL'
  console.log(
    `${mark}  w=${String(w).padEnd(4)} status=${res.status} type=${type} bytes=${bytes}`,
  )
  return ok
}

const { url, source } = await liveImageUrl()
console.log(`base=${BASE}`)
console.log(`image (${source}): ${url}`)

let allOk = true
for (const w of TIERS) {
  allOk = (await checkTier(url, w)) && allOk
}

// Contract guards: non-whitelisted w and non-75 q must be rejected, otherwise
// the app-side whitelist logic no longer matches the server.
const badW = await fetch(
  `${BASE}/_next/image?url=${encodeURIComponent(url)}&w=16&q=75`,
  { headers: { Accept: ACCEPT } },
)
const badQ = await fetch(
  `${BASE}/_next/image?url=${encodeURIComponent(url)}&w=384&q=80`,
  { headers: { Accept: ACCEPT } },
)
const guardsOk = badW.status === 400 && badQ.status === 400
console.log(
  `${guardsOk ? 'ok' : 'FAIL'}  contract guards: w=16 → ${badW.status} (want 400), q=80 → ${badQ.status} (want 400)`,
)
allOk = allOk && guardsOk

if (!allOk) {
  console.error('image optimizer smoke test FAILED')
  process.exit(1)
}
console.log('image optimizer smoke test passed')
