// Generates assets/images/grain.png — the noise tile GrainOverlay repeats
// across the screen. Half the pixels are clear; the rest are black or white
// at a random alpha, so at 5% overlay opacity the page gets speckle, not a
// grey wash. Deterministic (seeded), so re-running produces the same file.
//
//   node scripts/gen-grain.mjs

import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SIZE = 96
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'images', 'grain.png')

let seed = 0x5eed1234
const rnd = () => {
  seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff
  return seed / 0x7fffffff
}

const stride = SIZE * 4 + 1
const raw = Buffer.alloc(stride * SIZE)
for (let y = 0; y < SIZE; y++) {
  raw[y * stride] = 0 // filter: none
  for (let x = 0; x < SIZE; x++) {
    const o = y * stride + 1 + x * 4
    const lit = rnd() < 0.5
    const white = rnd() < 0.5
    const v = white ? 255 : 0
    raw[o] = v
    raw[o + 1] = v
    raw[o + 2] = v
    raw[o + 3] = lit ? Math.floor(70 + rnd() * 150) : 0
  }
}

const table = new Int32Array(256)
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  table[n] = c
}
const crc32 = (buf) => {
  let c = -1
  for (const b of buf) c = table[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(SIZE, 0)
ihdr.writeUInt32BE(SIZE, 4)
ihdr[8] = 8 // bit depth
ihdr[9] = 6 // RGBA
ihdr[10] = 0
ihdr[11] = 0
ihdr[12] = 0

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
])
writeFileSync(OUT, png)
console.log(`wrote ${OUT} (${png.length} bytes, ${SIZE}x${SIZE})`)
