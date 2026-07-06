// Registry + lifecycle for the Mandy's order Live Activity.
//
// ACTOR, not a class: expo-modules-core runs each AsyncFunction call on its
// own Task with no serialization, and at the delivered moment JS genuinely
// races two fire-and-forget paths onto the same order (the tracking-poll
// mirror and the orders-store subscription both call end). Plain dictionary
// state would be a concurrent-write EXC_BAD_ACCESS; actor isolation
// serializes every entry point. It also fixes the ensureRestored() ordering
// hazard (restored=true set before the registry is populated): the method
// has no suspension points, so under the actor it runs atomically — a racing
// update() either performs the restore itself or observes it fully done,
// never the half-restored empty registry.
//
// Keyed by Square orderId (NOT the display orderNumber). The orderId →
// Activity.id mapping is persisted in App Group UserDefaults so a cold app
// start can re-attach to activities that are still alive on the lock screen
// (JS then keeps update/end working after a relaunch without any JS-side
// persistence; updates for unknown orderIds are simply reported false).

import Foundation
#if canImport(ActivityKit)
import ActivityKit
#endif

@available(iOS 16.2, *)
actor OrderActivityController {
  static let shared = OrderActivityController()

  /// Receives (orderId, tokenHex) for every APNs push-token emission —
  /// including the replay of an already-issued token on re-attach, and
  /// rotations.
  private var onPushToken: ((String, String) -> Void)?

  private var activities: [String: Activity<MandysOrderAttributes>] = [:]
  private var tokenTasks: [String: Task<Void, Never>] = [:]
  private var restored = false
  private let defaults = UserDefaults(suiteName: MandysAppGroup.identifier)
  private let mapKey = "mandys.liveActivity.orderIdToActivityId"

  private init() {}

  func setOnPushToken(_ handler: @escaping (String, String) -> Void) {
    onPushToken = handler
  }

  // MARK: persistence of orderId → activity.id

  private var storedIds: [String: String] {
    get { (defaults?.dictionary(forKey: mapKey) as? [String: String]) ?? [:] }
    set { defaults?.set(newValue, forKey: mapKey) }
  }

  /// Re-attach to system-tracked activities after an app relaunch, and
  /// garbage-collect mappings whose activity is gone. No suspension points
  /// inside — atomic under the actor.
  private func ensureRestored() {
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

  /// Returns the ActivityKit activity id, or nil when activities are
  /// disabled by the user/system.
  func start(
    orderId: String,
    attributes: MandysOrderAttributes,
    state: MandysOrderAttributes.ContentState
  ) async throws -> String? {
    ensureRestored()
    guard ActivityAuthorizationInfo().areActivitiesEnabled else { return nil }

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
      // The render was a suspension point — a concurrent start for the same
      // order may have won the race while we were off the actor.
      if let existing = activities[orderId] {
        await existing.update(content(for: state, kind: attributes.kind))
        return existing.id
      }
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
    // Deregister BEFORE the await: at the delivered moment JS races two
    // fire-and-forget end paths (tracking-poll mirror + orders-store
    // subscription); the loser should get a clean found=false instead of
    // double-ending the same activity.
    tokenTasks[orderId]?.cancel()
    tokenTasks[orderId] = nil
    activities[orderId] = nil
    var ids = storedIds
    ids[orderId] = nil
    storedIds = ids

    let finalContent = state.map {
      ActivityContent(state: $0, staleDate: nil)
    }
    await activity.end(
      finalContent,
      dismissalPolicy: immediateDismissal ? .immediate : .default
    )
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
      // Replay the already-issued token first: pushTokenUpdates only yields
      // NEW emissions, so a cold-start re-attach would otherwise never see a
      // token issued before the relaunch — if its upload failed and the app
      // was killed, the server would lose that activity forever. JS dedupes
      // per (orderId, token), so replay/stream overlap is harmless.
      if let current = activity.pushToken {
        await self?.emitToken(orderId: orderId, tokenData: current)
      }
      for await tokenData in activity.pushTokenUpdates {
        await self?.emitToken(orderId: orderId, tokenData: tokenData)
      }
    }
  }

  private func emitToken(orderId: String, tokenData: Data) {
    let hex = tokenData.map { String(format: "%02x", $0) }.joined()
    onPushToken?(orderId, hex)
  }
}
