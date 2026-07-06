// MandysOrderAttributes — the pinned cross-platform Live Activity contract.
//
// ⚠️ CONTRACT FILE — the exact same struct is compiled into the app target at
// modules/order-live-activity/ios/MandysOrderAttributes.swift, and the web
// backend builds `aps.content-state` payloads that must decode into
// ContentState. Keep all three in sync; do not rename fields.
//
// kind:   "pickup" | "delivery"
// status: pickup   → "preparing" | "ready" | "completed" | "canceled"
//         delivery → "pending" | "accepted" | "picked_up" | "delivered" | "canceled"

import ActivityKit
import Foundation

// Annotated 16.2 (not just ActivityKit's 16.1 floor) because the whole
// feature is gated on the 16.2 push-token / ActivityContent API surface.
// The widget target deploys at 16.2 so this is a no-op there; the app-side
// module deploys at the app's 15.1 floor and needs the gate.
@available(iOS 16.2, *)
struct MandysOrderAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    var status: String
    var driverName: String?
    var driverLat: Double?
    var driverLng: Double?
    /// Unix seconds of the update (server clock for pushes).
    var updatedAt: Double
  }

  /// "pickup" | "delivery"
  var kind: String
  /// e.g. "OL123" / "DE045" (no leading '#'; views add it)
  var orderNumber: String
  /// Pickup only — static wait estimate pill, e.g. "~8–12 min".
  var waitText: String?
  var storeLat: Double?
  var storeLng: Double?
  var destLat: Double?
  var destLng: Double?
  /// Delivery only — PNG snapshot inside the App Group container rendered by
  /// MKMapSnapshotter at order time. nil → widget falls back to the stepper
  /// layout (S3/S4) even while out for delivery.
  var mapImageFilename: String?
}

enum MandysAppGroup {
  static let identifier = "group.com.mandysbubbletea.app"

  static func containerURL() -> URL? {
    FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: identifier)
  }
}
