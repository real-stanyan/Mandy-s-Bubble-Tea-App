// Executable spec for the bbox/projection math twinned in Swift
// (targets/order-activity/GeoProjection.swift + module copy). If these
// numbers change, the Swift twins MUST change identically or the widget's
// rider dot drifts off the MKMapSnapshotter image.

import {
  computeMapBBox,
  hasUsableMapCoords,
  MAP_ASPECT,
  METERS_PER_DEG_LAT,
  METERS_PER_DEG_LNG_EQUATOR,
  MIN_SPAN_METERS,
  projectToUnit,
} from './live-activity-geo'

// Real store → a Southport-ish destination (suburb scale, like production).
const STORE = { lat: -27.966, lng: 153.4115 }
const DEST = { lat: -27.9755, lng: 153.398 }

function widthMeters(b: { minLat: number; maxLat: number; minLng: number; maxLng: number }) {
  const midLat = (b.minLat + b.maxLat) / 2
  return (b.maxLng - b.minLng) * METERS_PER_DEG_LNG_EQUATOR * Math.cos((midLat * Math.PI) / 180)
}
function heightMeters(b: { minLat: number; maxLat: number }) {
  return (b.maxLat - b.minLat) * METERS_PER_DEG_LAT
}

describe('computeMapBBox', () => {
  it('contains both endpoints with padding to spare', () => {
    const b = computeMapBBox(STORE.lat, STORE.lng, DEST.lat, DEST.lng)
    expect(b.minLat).toBeLessThan(Math.min(STORE.lat, DEST.lat))
    expect(b.maxLat).toBeGreaterThan(Math.max(STORE.lat, DEST.lat))
    expect(b.minLng).toBeLessThan(Math.min(STORE.lng, DEST.lng))
    expect(b.maxLng).toBeGreaterThan(Math.max(STORE.lng, DEST.lng))
  })

  it('pads each axis by the ratio before aspect correction (checkable on the non-expanded axis)', () => {
    const b = computeMapBBox(STORE.lat, STORE.lng, DEST.lat, DEST.lng, 0.3)
    // This pair is taller (in aspect terms) than 365:92, so the LAT axis is
    // untouched by aspect correction and must be exactly raw span + 2×30%.
    const rawLatSpan = Math.abs(STORE.lat - DEST.lat)
    expect(b.maxLat - b.minLat).toBeCloseTo(rawLatSpan * 1.6, 10)
    // ...which means the LNG axis was the one expanded.
    expect(widthMeters(b) / heightMeters(b)).toBeCloseTo(MAP_ASPECT, 5)
  })

  it('matches the physical aspect ratio of the 365×92 map zone', () => {
    const b = computeMapBBox(STORE.lat, STORE.lng, DEST.lat, DEST.lng)
    expect(widthMeters(b) / heightMeters(b)).toBeCloseTo(MAP_ASPECT, 5)
  })

  it('only ever expands an axis (both endpoints keep their padding)', () => {
    // A very WIDE pair: aspect correction must grow lat, not shrink lng.
    const b = computeMapBBox(-27.97, 153.3, -27.9701, 153.45)
    expect(b.minLng).toBeLessThan(153.3)
    expect(b.maxLng).toBeGreaterThan(153.45)
    expect(widthMeters(b) / heightMeters(b)).toBeCloseTo(MAP_ASPECT, 5)
  })

  it('enforces the minimum physical span for near-identical points', () => {
    const b = computeMapBBox(STORE.lat, STORE.lng, STORE.lat + 1e-7, STORE.lng + 1e-7)
    expect(heightMeters(b)).toBeGreaterThanOrEqual(MIN_SPAN_METERS * 0.999)
    expect(widthMeters(b)).toBeGreaterThanOrEqual(MIN_SPAN_METERS * 0.999)
    expect(widthMeters(b) / heightMeters(b)).toBeCloseTo(MAP_ASPECT, 5)
  })

  it('is symmetric in argument order', () => {
    const a = computeMapBBox(STORE.lat, STORE.lng, DEST.lat, DEST.lng)
    const b = computeMapBBox(DEST.lat, DEST.lng, STORE.lat, STORE.lng)
    expect(a).toEqual(b)
  })
})

describe('projectToUnit', () => {
  const b = computeMapBBox(STORE.lat, STORE.lng, DEST.lat, DEST.lng)

  it('maps bbox corners to unit corners (y flipped: north = 0)', () => {
    expect(projectToUnit(b.maxLat, b.minLng, b)).toEqual({ x: 0, y: 0 })
    expect(projectToUnit(b.minLat, b.maxLng, b)).toEqual({ x: 1, y: 1 })
  })

  it('maps the bbox centre to (0.5, 0.5)', () => {
    const p = projectToUnit((b.minLat + b.maxLat) / 2, (b.minLng + b.maxLng) / 2, b)
    expect(p.x).toBeCloseTo(0.5, 10)
    expect(p.y).toBeCloseTo(0.5, 10)
  })

  it('keeps both endpoints inside the unit square (padding guarantees margin)', () => {
    for (const pt of [STORE, DEST]) {
      const p = projectToUnit(pt.lat, pt.lng, b)
      expect(p.x).toBeGreaterThan(0.05)
      expect(p.x).toBeLessThan(0.95)
      expect(p.y).toBeGreaterThan(0.05)
      expect(p.y).toBeLessThan(0.95)
    }
  })

  it('degenerate zero-span bbox projects to the centre instead of NaN', () => {
    const degenerate = { minLat: -27, maxLat: -27, minLng: 153, maxLng: 153 }
    expect(projectToUnit(-27, 153, degenerate)).toEqual({ x: 0.5, y: 0.5 })
  })
})

describe('hasUsableMapCoords', () => {
  it('accepts a real store→dest pair', () => {
    expect(hasUsableMapCoords(STORE.lat, STORE.lng, DEST.lat, DEST.lng)).toBe(true)
  })

  it('rejects missing values', () => {
    expect(hasUsableMapCoords(null, STORE.lng, DEST.lat, DEST.lng)).toBe(false)
    expect(hasUsableMapCoords(STORE.lat, STORE.lng, undefined, DEST.lng)).toBe(false)
  })

  it('rejects the (0,0) unresolved-address sentinel the cart persists', () => {
    expect(hasUsableMapCoords(STORE.lat, STORE.lng, 0, 0)).toBe(false)
  })

  it('rejects out-of-range and non-finite coordinates', () => {
    expect(hasUsableMapCoords(STORE.lat, STORE.lng, 91, DEST.lng)).toBe(false)
    expect(hasUsableMapCoords(STORE.lat, STORE.lng, DEST.lat, 181)).toBe(false)
    expect(hasUsableMapCoords(STORE.lat, NaN, DEST.lat, DEST.lng)).toBe(false)
  })
})
