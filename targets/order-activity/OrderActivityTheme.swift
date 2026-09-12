// Brand tokens (mirrors constants/theme.ts `T`) + status → copy derivation
// (wording mirrors lib/dispatch-steps.ts / the S1–S7 mockup).

import SwiftUI

@available(iOS 16.2, *)
enum MandysColor {
  static let paper = Color(hex: 0xFFF9F0)
  static let cream = Color(hex: 0xFFF3DE)
  static let creamDeep = Color(hex: 0xF7E3C4)
  static let ink = Color(hex: 0x2A1E14)
  static let ink2 = Color(hex: 0x5A4330)
  static let ink3 = Color(hex: 0x2A1E14).opacity(0.55)
  static let brand = Color(hex: 0x8D5524)
  static let brandLight = Color(hex: 0xB97A3F)
  static let brandDark = Color(hex: 0x6B3E15)
  static let sage = Color(hex: 0xA2AD91)
  static let sageDeep = Color(hex: 0x8CA07D)
  static let green = Color(hex: 0x3CA96E)
  static let greenDark = Color(hex: 0x2E7F52)
  static let amber = Color(hex: 0xC9A227)
  /// Amber as TEXT on light/cream backgrounds (mock's paused-copy tone).
  static let amberDark = Color(hex: 0x8A6E14)
  /// Amber-tinted cream — the "received" card's warm golden bottom stop.
  static let receivedCream = Color(hex: 0xF6E7B3)
  /// Warm amber for text on dark (Dynamic Island) backgrounds.
  static let amberOnDark = Color(hex: 0xE8CF7A)

  // delivery dark-sage card
  static let deliveryBg1 = Color(hex: 0x39443A)
  static let deliveryBg2 = Color(hex: 0x2E3830)
  static let deliveryBg3 = Color(hex: 0x26302A)
  static let deliveryText = Color(hex: 0xEEF2E8)
  static let deliveryHeading = Color(hex: 0xF5F7EF)

  // out-for-delivery light sage strip
  static let liveSage1 = Color(hex: 0xA2AD91)
  static let liveSage2 = Color(hex: 0x97A587)
  static let liveInk = Color(hex: 0x26301F)
  static let liveInkSoft = Color(hex: 0x2F3A2C)
  static let liveDone = Color(hex: 0x46543E)

  // ready greens
  static let readyBg1 = Color(hex: 0xEAF6EC)
  static let readyBg2 = Color(hex: 0xD8EEDD)
  static let readyHeading = Color(hex: 0x1F4D35)
}

@available(iOS 16.2, *)
extension Color {
  init(hex: UInt32) {
    self.init(
      .sRGB,
      red: Double((hex >> 16) & 0xFF) / 255,
      green: Double((hex >> 8) & 0xFF) / 255,
      blue: Double(hex & 0xFF) / 255,
      opacity: 1
    )
  }
}

// MARK: - Status models

@available(iOS 16.2, *)
enum PickupPhase {
  // 3-step card: Received → Preparing → Ready. "received" is the contract's
  // initial state (order placed, staff haven't accepted); the server's
  // RESERVED push flips to preparing, PREPARED to ready — and the shop may
  // skip RESERVED entirely, so received can jump straight to ready.
  case received, preparing, ready, completed, canceled

  init(status: String) {
    switch status {
    case "preparing": self = .preparing
    case "ready": self = .ready
    case "completed": self = .completed
    case "canceled": self = .canceled
    // "received" and anything unknown: the honest minimum claim is only
    // "we have your order".
    default: self = .received
    }
  }

  var heading: String {
    switch self {
    case .received: return "Order received!"
    case .preparing: return "We're making your drinks"
    case .ready: return "Ready for pickup!"
    case .completed: return "Picked up — enjoy!"
    case .canceled: return "Order Canceled"
    }
  }

  var sub: String {
    switch self {
    case .received: return "We'll start making it shortly"
    case .preparing: return "Freshly shaken to order"
    case .ready: return "Mandy's Bubble Tea"
    case .completed: return "Thanks for visiting Mandy's"
    case .canceled: return "This order was canceled"
    }
  }

  /// Compact Dynamic Island short word ("Making" gains "· ~X min" in the
  /// island when a wait estimate exists).
  var shortStatus: String {
    switch self {
    case .received: return "Order in"
    case .preparing: return "Making"
    case .ready: return "Ready!"
    case .completed: return "Picked up"
    case .canceled: return "Canceled"
    }
  }

  /// Index of the current step on the 3-step stepper
  /// (0 Received / 1 Preparing / 2 Ready).
  var stepIndex: Int {
    switch self {
    case .received, .canceled: return 0
    case .preparing: return 1
    case .ready, .completed: return 2
    }
  }

  var isDone: Bool { self == .ready || self == .completed }
}

@available(iOS 16.2, *)
enum DeliveryPhase {
  case pending, accepted, pickedUp, delivered, canceled

  init(status: String) {
    switch status {
    case "accepted": self = .accepted
    case "picked_up": self = .pickedUp
    case "delivered": self = .delivered
    case "canceled": self = .canceled
    default: self = .pending
    }
  }

  /// 4-step stepper index (Finding driver → To the shop → On the way → Delivered).
  var stepIndex: Int {
    switch self {
    case .pending, .canceled: return 0
    case .accepted: return 1
    case .pickedUp: return 2
    case .delivered: return 3
    }
  }

  static let stepLabels = ["Finding driver", "To the shop", "On the way", "Delivered"]

  func heading(driverName: String?) -> String {
    switch self {
    case .pending: return "Finding your driver"
    case .accepted: return "Driver on the way to the shop"
    case .pickedUp: return "Your order is on the way"
    case .delivered: return "Delivered — enjoy! 🧋"
    case .canceled: return "Order Canceled"
    }
  }

  func sub(driverName: String?) -> String {
    let name = (driverName?.isEmpty == false) ? driverName! : "Your driver"
    switch self {
    case .pending: return "Usually takes a couple of minutes"
    case .accepted: return "\(name) is heading to the shop to collect your order"
    case .pickedUp: return "\(name) has your order and is on the way"
    case .delivered: return "Thanks for ordering from Mandy's"
    case .canceled: return "This order was canceled"
    }
  }

  var shortStatus: String {
    switch self {
    case .pending: return "Finding"
    case .accepted: return "To shop"
    case .pickedUp: return "On the way"
    case .delivered: return "Delivered"
    case .canceled: return "Canceled"
    }
  }

  var markEmoji: String {
    switch self {
    case .accepted, .pickedUp: return "🛵"
    default: return "🧋"
    }
  }
}

// MARK: - Live progress window

/// The only motion a Live Activity can run on its own is a timer: the system
/// drives `ProgressView(timerInterval:)` / `Text(timerInterval:)` without a
/// push. The window for "preparing" starts when that state was pushed
/// (`updatedAt`) and ends after the UPPER bound of the wait estimate
/// ("~8–12 mins" → 12; "15+ mins" → 15). Past the end the bar simply sits
/// full — "any moment now" is the honest reading. nil when there is no
/// estimate, so callers fall back to the static in-progress fill.
@available(iOS 16.2, *)
enum PickupProgressWindow {
  static func make(waitText: String?, updatedAt: Double) -> ClosedRange<Date>? {
    guard let waitText, let minutes = upperMinutes(in: waitText), minutes > 0 else { return nil }
    let start = Date(timeIntervalSince1970: updatedAt)
    let end = start.addingTimeInterval(TimeInterval(minutes) * 60)
    return start...end
  }

  /// Last run of digits in the string — the top of a range, or the number
  /// itself for "6 min" / "15+ mins".
  static func upperMinutes(in text: String) -> Int? {
    var runs: [Int] = []
    var current = ""
    for ch in text {
      if ch.isNumber { current.append(ch) }
      else if !current.isEmpty { runs.append(Int(current) ?? 0); current = "" }
    }
    if !current.isEmpty { runs.append(Int(current) ?? 0) }
    return runs.last
  }
}

// MARK: - Shared little views

@available(iOS 16.2, *)
struct Eyebrow: View {
  let text: String
  let color: Color
  var size: CGFloat = 9.5

  var body: some View {
    Text(text.uppercased())
      .font(.system(size: size, weight: .bold, design: .monospaced))
      .tracking(1.3)
      .foregroundColor(color)
      .lineLimit(1)
      .minimumScaleFactor(0.8)
  }
}

@available(iOS 16.2, *)
struct OrderNo: View {
  let number: String
  let color: Color
  var size: CGFloat = 10.5

  var body: some View {
    Text("#\(number)")
      .font(.system(size: size, weight: .bold, design: .monospaced))
      .tracking(0.6)
      .foregroundColor(color)
      .lineLimit(1)
  }
}

@available(iOS 16.2, *)
enum MandysFormat {
  /// "1.2 km away" / "250 m away" — mirrors lib/delivery.ts distanceKmText().
  static func distanceAway(
    driverLat: Double?, driverLng: Double?,
    destLat: Double?, destLng: Double?
  ) -> String? {
    guard let dLat = driverLat, let dLng = driverLng,
          let tLat = destLat, let tLng = destLng else { return nil }
    let km = GeoProjection.haversineKm(lat1: dLat, lng1: dLng, lat2: tLat, lng2: tLng)
    guard km.isFinite else { return nil }
    if km < 0.95 {
      let m = max(50, Int((km * 1000 / 50).rounded()) * 50)
      return "\(m) m away"
    }
    return String(format: "%.1f km away", km)
  }
}
