// Registry + lifecycle for the Mandy's order Live Activity.
//
// Keyed by Square orderId (NOT the display orderNumber). The orderId →
// Activity.id mapping is persisted in App Group UserDefaults so a cold app
// start can re-attach to activities that are still alive on the lock screen
// (JS then keeps update/end working after a relaunch without any JS-side
// persistence — updates for unknown orderIds are simply reported false).

import Foundation
#if canImport(ActivityKit)
import ActivityKit
#endif

@available(iOS 16.2, *)
final class OrderActivityController {
  static let shared = OrderActivityController()

  /// Set by the module; receives (orderId, tokenHex) for every APNs
  /// push-token emission (including rotations).
  var onPushToken: ((String, String) -> Void)?

  private var activities: [String: Activity<MandysOrderAttributes>] = [:]
  private var tokenTasks: [String: Task<Void, Never>] = [:]
  private var restored = false
  private let defaults = UserDefaults(suiteName: MandysAppGroup.identifier)
  private let mapKey = "mandys.liveActivity.orderIdToActivityId"

  private init() {}

  // MARK: persistence of orderId → activity.id

  private var storedIds: [String: String] {
    get { (defaults?.dictionary(forKey: mapKey) as? [String: String]) ?? [:] }
    set { defaults?.set(newValue, forKey: mapKey) }
  }

  /// Re-attach to system-tracked activities after an app relaunch, and
  /// garbage-collect mappings whose activity is gone.
  func ensureRestored() {
    guard !restored else { return }
    restored = true
    let stored = storedIds
    guard !stored.isEmpty else { return }
    var alive: [String: String] = [:]
    for activity in Activity<MandysOrderAttributes>.activities {
      if let (orderId, _) = stored.first(where: { $0.value == activity.id }) {
        activities[orderId] = activity
        observePushToken(orderId: orderId, activity: activity)
        alive[orderId] = activity.id
      }
    }
    storedIds = alive
  }

  // MARK: lifecycle

  var areActivitiesEnabled: Bool {
    ActivityAuthorizationInfo().areActivitiesEnabled
  }

  /// Returns the ActivityKit activity id, or nil when activities are
  /// disabled by the user/system.
  func start(
    orderId: String,
    attributes: MandysOrderAttributes,
    state: MandysOrderAttributes.ContentState
  ) async throws -> String? {
    ensureRestored()
    guard areActivitiesEnabled else { return nil }

    // Idempotent per order: a re-fired checkout success (retry paths) must
    // not stack a second lock-screen card.
    if let existing = activities[orderId] {
      await existing.update(content(for: state, kind: attributes.kind))
      return existing.id
    }

    var attrs = attributes
    // Delivery: pre-render the S5 map snapshot; degrade to the stepper
    // layout (attrs.mapImageFilename = nil) on any failure.
    if attrs.kind == "delivery",
       let sLat = attrs.storeLat, let sLng = attrs.storeLng,
       let dLat = attrs.destLat, let dLng = attrs.destLng {
      attrs.mapImageFilename = try? await MapSnapshotRenderer.render(
        orderId: orderId, storeLat: sLat, storeLng: sLng, destLat: dLat, destLng: dLng
      )
    }

    let activity = try Activity.request(
      attributes: attrs,
      content: content(for: state, kind: attrs.kind),
      pushType: .token
    )
    activities[orderId] = activity
    var ids = storedIds
    ids[orderId] = activity.id
    storedIds = ids
    observePushToken(orderId: orderId, activity: activity)
    return activity.id
  }

  /// Returns false when no live activity is registered for the order.
  func update(orderId: String, state: MandysOrderAttributes.ContentState) async -> Bool {
    ensureRestored()
    guard let activity = activities[orderId] else { return false }
    await activity.update(content(for: state, kind: activity.attributes.kind))
    return true
  }

  /// Returns false when no live activity is registered for the order.
  /// `immediate` dismissal for canceled orders; the system default
  /// (lingering final frame) otherwise.
  func end(
    orderId: String,
    state: MandysOrderAttributes.ContentState?,
    immediateDismissal: Bool
  ) async -> Bool {
    ensureRestored()
    guard let activity = activities[orderId] else { return false }
    let finalContent = state.map {
      ActivityContent(state: $0, staleDate: nil)
    }
    await activity.end(
      finalContent,
      dismissalPolicy: immediateDismissal ? .immediate : .default
    )
    tokenTasks[orderId]?.cancel()
    tokenTasks[orderId] = nil
    activities[orderId] = nil
    var ids = storedIds
    ids[orderId] = nil
    storedIds = ids
    MapSnapshotRenderer.deleteSnapshot(orderId: orderId)
    return true
  }

  // MARK: helpers

  /// Cross-端契约: GPS-phase pushes carry stale-date = now + 90s; local
  /// delivery updates mirror that so a dead stream flips the card into the
  /// PAUSED state (S5b). Pickup has no GPS => no staleness semantics.
  private func content(
    for state: MandysOrderAttributes.ContentState,
    kind: String
  ) -> ActivityContent<MandysOrderAttributes.ContentState> {
    ActivityContent(
      state: state,
      staleDate: kind == "delivery" ? Date().addingTimeInterval(90) : nil
    )
  }

  private func observePushToken(orderId: String, activity: Activity<MandysOrderAttributes>) {
    tokenTasks[orderId]?.cancel()
    tokenTasks[orderId] = Task { [weak self] in
      for await tokenData in activity.pushTokenUpdates {
        let hex = tokenData.map { String(format: "%02x", $0) }.joined()
        self?.onPushToken?(orderId, hex)
      }
    }
  }
}
