// TypeScript twin of the Swift GeoProjection (targets/order-activity/
// GeoProjection.swift + modules/order-live-activity/ios/GeoProjection.swift).
//
// Swift is not unit-tested in this repo, so this file is the jest-tested
// executable spec for the bbox/projection math: the app-side snapshot region
// and the widget-side pin projection MUST both match this algorithm or the
// rider dot drifts off the route. Keep all three implementations in sync.
//
// It's also used at start time to decide whether a delivery order has
// map-usable coordinates at all (hasUsableMapCoords).

export type GeoBBox = {
  minLat: number
  maxLat: number
  minLng: number
  maxLng: number
}

/** Metres per degree of latitude (WGS-84 mean). */
export const METERS_PER_DEG_LAT = 110_574
/** Metres per degree of longitude at the equator. */
export const METERS_PER_DEG_LNG_EQUATOR = 111_320
/** Minimum bbox edge in metres so a store≈dest pair still renders a map. */
export const MIN_SPAN_METERS = 300
/** Live Activity map zone is 365×92pt (mockup S5). */
export const MAP_ASPECT = 365 / 92

/** Padded, aspect-corrected bbox around the store→destination pair.
 *  1. raw bbox → 2. pad each axis by paddingRatio of its span (both sides)
 *  → 3. enforce a minimum physical span → 4. expand ONE axis (never shrink)
 *  until widthMeters/heightMeters == aspect. */
export function computeMapBBox(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
  paddingRatio = 0.3,
  aspect = MAP_ASPECT,
): GeoBBox {
  let minLat = Math.min(lat1, lat2)
  let maxLat = Math.max(lat1, lat2)
  let minLng = Math.min(lng1, lng2)
  let maxLng = Math.max(lng1, lng2)

  // 2. padding
  const latPad = (maxLat - minLat) * paddingRatio
  const lngPad = (maxLng - minLng) * paddingRatio
  minLat -= latPad
  maxLat += latPad
  minLng -= lngPad
  maxLng += lngPad

  // 3. minimum physical span
  const midLat = (minLat + maxLat) / 2
  const cosLat = Math.max(0.01, Math.cos((midLat * Math.PI) / 180))
  const metersPerDegLng = METERS_PER_DEG_LNG_EQUATOR * cosLat
  const minLatSpan = MIN_SPAN_METERS / METERS_PER_DEG_LAT
  const minLngSpan = MIN_SPAN_METERS / metersPerDegLng
  if (maxLat - minLat < minLatSpan) {
    const grow = (minLatSpan - (maxLat - minLat)) / 2
    minLat -= grow
    maxLat += grow
  }
  if (maxLng - minLng < minLngSpan) {
    const grow = (minLngSpan - (maxLng - minLng)) / 2
    minLng -= grow
    maxLng += grow
  }

  // 4. aspect-correct by expanding one axis around its centre
  const widthM = (maxLng - minLng) * metersPerDegLng
  const heightM = (maxLat - minLat) * METERS_PER_DEG_LAT
  if (widthM / heightM < aspect) {
    const grow = ((heightM * aspect - widthM) / metersPerDegLng) / 2
    minLng -= grow
    maxLng += grow
  } else {
    const grow = ((widthM / aspect - heightM) / METERS_PER_DEG_LAT) / 2
    minLat -= grow
    maxLat += grow
  }

  return { minLat, maxLat, minLng, maxLng }
}

/** Projects a coordinate into unit space of the bbox: x → 0 (west) … 1
 *  (east), y → 0 (top/north) … 1 (bottom/south). Not clamped. */
export function projectToUnit(
  lat: number,
  lng: number,
  bbox: GeoBBox,
): { x: number; y: number } {
  const latSpan = bbox.maxLat - bbox.minLat
  const lngSpan = bbox.maxLng - bbox.minLng
  return {
    x: lngSpan === 0 ? 0.5 : (lng - bbox.minLng) / lngSpan,
    y: latSpan === 0 ? 0.5 : (bbox.maxLat - lat) / latSpan,
  }
}

/** True when both endpoints are real coordinates the snapshot/projection can
 *  work with. Cart addresses persist lat/lng as 0 when unresolved — treat
 *  (0,0) (and anything absurd) as unusable so the widget takes the stepper
 *  fallback instead of a map of the Gulf of Guinea. */
export function hasUsableMapCoords(
  storeLat: number | null | undefined,
  storeLng: number | null | undefined,
  destLat: number | null | undefined,
  destLng: number | null | undefined,
): boolean {
  const pts: [number | null | undefined, number | null | undefined][] = [
    [storeLat, storeLng],
    [destLat, destLng],
  ]
  for (const [lat, lng] of pts) {
    if (lat == null || lng == null) return false
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false
    if (lat === 0 && lng === 0) return false
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return false
  }
  return true
}
