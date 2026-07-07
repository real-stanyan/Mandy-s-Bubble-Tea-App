// GeoProjection — pure bbox + linear projection math for the delivery map.
//
// ⚠️ TWINNED IMPLEMENTATION — the identical algorithm exists in:
//   • modules/order-live-activity/ios/GeoProjection.swift (app target — feeds
//     MKMapSnapshotter's region so the snapshot covers exactly this bbox)
//   • lib/live-activity-geo.ts (TypeScript twin — the jest-tested executable
//     spec for this math; Swift is not unit-tested in this repo)
// The widget re-derives the same bbox from the attributes' store/dest coords,
// so projecting driverLat/Lng into unit space lines up with the snapshot.

import Foundation

enum GeoProjection {
  struct BBox: Equatable {
    var minLat: Double
    var maxLat: Double
    var minLng: Double
    var maxLng: Double

    var midLat: Double { (minLat + maxLat) / 2 }
    var midLng: Double { (minLng + maxLng) / 2 }
    var latSpan: Double { maxLat - minLat }
    var lngSpan: Double { maxLng - minLng }
  }

  /// Metres per degree of latitude (WGS-84 mean).
  static let metersPerDegLat = 110_574.0
  /// Metres per degree of longitude at the equator.
  static let metersPerDegLngEquator = 111_320.0
  /// Minimum bbox edge in metres so a store≈dest pair still renders a map.
  static let minSpanMeters = 300.0

  /// Padded, aspect-corrected bbox around the store→destination pair.
  ///
  /// 1. Raw bbox of the two points.
  /// 2. Pad each axis by `paddingRatio` of its span (both sides).
  /// 3. Enforce a minimum physical span on each axis.
  /// 4. Expand ONE axis (never shrink) so widthMeters/heightMeters == aspect —
  ///    this is what makes a naive linear projection line up with the
  ///    MKMapSnapshotter render of the same region.
  static func bbox(
    lat1: Double, lng1: Double,
    lat2: Double, lng2: Double,
    paddingRatio: Double = 0.3,
    aspect: Double = 365.0 / 110.0
  ) -> BBox {
    var minLat = min(lat1, lat2)
    var maxLat = max(lat1, lat2)
    var minLng = min(lng1, lng2)
    var maxLng = max(lng1, lng2)

    // 2. padding
    let latPad = (maxLat - minLat) * paddingRatio
    let lngPad = (maxLng - minLng) * paddingRatio
    minLat -= latPad; maxLat += latPad
    minLng -= lngPad; maxLng += lngPad

    // 3. minimum physical span
    let midLat = (minLat + maxLat) / 2
    let cosLat = max(0.01, cos(midLat * .pi / 180))
    let metersPerDegLng = metersPerDegLngEquator * cosLat
    let minLatSpan = minSpanMeters / metersPerDegLat
    let minLngSpan = minSpanMeters / metersPerDegLng
    if maxLat - minLat < minLatSpan {
      let grow = (minLatSpan - (maxLat - minLat)) / 2
      minLat -= grow; maxLat += grow
    }
    if maxLng - minLng < minLngSpan {
      let grow = (minLngSpan - (maxLng - minLng)) / 2
      minLng -= grow; maxLng += grow
    }

    // 4. aspect-correct by expanding one axis around its centre
    let widthM = (maxLng - minLng) * metersPerDegLng
    let heightM = (maxLat - minLat) * metersPerDegLat
    if widthM / heightM < aspect {
      let targetWidthM = heightM * aspect
      let grow = ((targetWidthM - widthM) / metersPerDegLng) / 2
      minLng -= grow; maxLng += grow
    } else {
      let targetHeightM = widthM / aspect
      let grow = ((targetHeightM - heightM) / metersPerDegLat) / 2
      minLat -= grow; maxLat += grow
    }

    return BBox(minLat: minLat, maxLat: maxLat, minLng: minLng, maxLng: maxLng)
  }

  /// Projects a coordinate into unit space of the bbox: x → 0(left/west) …
  /// 1(right/east), y → 0(top/north) … 1(bottom/south). Not clamped.
  static func project(lat: Double, lng: Double, in box: BBox) -> (x: Double, y: Double) {
    let x = box.lngSpan == 0 ? 0.5 : (lng - box.minLng) / box.lngSpan
    let y = box.latSpan == 0 ? 0.5 : (box.maxLat - lat) / box.latSpan
    return (x, y)
  }

  /// Straight-line distance in km (haversine — plenty at suburb scale).
  static func haversineKm(lat1: Double, lng1: Double, lat2: Double, lng2: Double) -> Double {
    let rad = { (d: Double) in d * .pi / 180 }
    let r = 6371.0
    let dLat = rad(lat2 - lat1)
    let dLng = rad(lng2 - lng1)
    let a = pow(sin(dLat / 2), 2) + cos(rad(lat1)) * cos(rad(lat2)) * pow(sin(dLng / 2), 2)
    return 2 * r * asin(sqrt(a))
  }
}
