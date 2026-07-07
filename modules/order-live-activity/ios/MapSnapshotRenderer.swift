// Renders the static light map snapshot for the delivery Live Activity
// (mockup S5) into the App Group container, BEFORE the activity starts.
//
// The snapshot region is the exact padded/aspect-corrected bbox from
// GeoProjection.bbox(store, dest) — the widget re-derives the same bbox from
// the attributes' coordinates, so its percentage projection of the pins and
// the pushed rider position lines up with this image.
//
// Any failure throws; the caller degrades to mapImageFilename = nil and the
// widget renders the stepper layout instead. No map is better than a wrong map.

import Foundation
import MapKit
import UIKit

enum MapSnapshotError: Error {
  case noAppGroupContainer
  case pngEncodingFailed
}

enum MapSnapshotRenderer {
  /// Card map zone is 365×110pt (mockup S5, grown 2026-07-07); render @3x for Pro-class screens.
  static let sizePoints = CGSize(width: 365, height: 110)

  static func render(
    orderId: String,
    storeLat: Double, storeLng: Double,
    destLat: Double, destLng: Double
  ) async throws -> String {
    let box = GeoProjection.bbox(lat1: storeLat, lng1: storeLng, lat2: destLat, lng2: destLng)

    let options = MKMapSnapshotter.Options()
    options.region = MKCoordinateRegion(
      center: CLLocationCoordinate2D(latitude: box.midLat, longitude: box.midLng),
      span: MKCoordinateSpan(latitudeDelta: box.latSpan, longitudeDelta: box.lngSpan)
    )
    options.size = sizePoints
    options.mapType = .mutedStandard
    options.pointOfInterestFilter = .excludingAll
    options.showsBuildings = false
    options.traitCollection = UITraitCollection(traitsFrom: [
      UITraitCollection(userInterfaceStyle: .light),
      UITraitCollection(displayScale: 3),
    ])

    let snapshot = try await MKMapSnapshotter(options: options).start()
    guard let png = snapshot.image.pngData() else {
      throw MapSnapshotError.pngEncodingFailed
    }
    guard let container = MandysAppGroup.containerURL() else {
      throw MapSnapshotError.noAppGroupContainer
    }
    let filename = fileName(orderId: orderId)
    try png.write(to: container.appendingPathComponent(filename), options: .atomic)
    return filename
  }

  static func fileName(orderId: String) -> String {
    // Square order ids are URL-safe alphanumerics, but sanitize anyway.
    let safe = orderId.replacingOccurrences(
      of: "[^A-Za-z0-9_-]", with: "_", options: .regularExpression
    )
    return "order-map-\(safe).png"
  }

  static func deleteSnapshot(orderId: String) {
    guard let container = MandysAppGroup.containerURL() else { return }
    try? FileManager.default.removeItem(
      at: container.appendingPathComponent(fileName(orderId: orderId))
    )
  }
}
