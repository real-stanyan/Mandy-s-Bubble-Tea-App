// expo-modules-core bridge for the Mandy's order Live Activity.
//
// JS surface (modules/order-live-activity/index.ts):
//   startOrderActivity(orderId, attributes, initialState) → activityId | null
//   updateOrderActivity(orderId, state) → Bool (false = unknown order)
//   endOrderActivity(orderId, finalState?, immediateDismissal) → Bool
//   areLiveActivitiesEnabled() → Bool
//   event "onOrderActivityPushToken" { orderId, token } — hex APNs
//     liveactivity token, re-emitted on every rotation.
//
// Everything is a graceful no-op (null/false) below iOS 16.2 or when Live
// Activities are disabled — callers never need their own platform gate.

import ExpoModulesCore
#if canImport(ActivityKit)
import ActivityKit
#endif

struct ActivityAttributesRecord: Record {
  @Field var kind: String = "pickup"
  @Field var orderNumber: String = ""
  @Field var waitText: String?
  @Field var storeLat: Double?
  @Field var storeLng: Double?
  @Field var destLat: Double?
  @Field var destLng: Double?
}

struct ContentStateRecord: Record {
  @Field var status: String = ""
  @Field var driverName: String?
  @Field var driverLat: Double?
  @Field var driverLng: Double?
  @Field var updatedAt: Double = 0
}

public class OrderLiveActivityModule: Module {
  public func definition() -> ModuleDefinition {
    Name("OrderLiveActivity")

    Events("onOrderActivityPushToken")

    OnCreate {
      if #available(iOS 16.2, *) {
        // The controller is an actor (serializes the racing JS end paths);
        // registering the token handler hops onto it.
        Task {
          await OrderActivityController.shared.setOnPushToken { [weak self] orderId, tokenHex in
            self?.sendEvent("onOrderActivityPushToken", [
              "orderId": orderId,
              "token": tokenHex,
            ])
          }
        }
      }
    }

    Function("areLiveActivitiesEnabled") { () -> Bool in
      if #available(iOS 16.2, *) {
        // Pure system query — no actor state involved, safe to stay sync.
        return ActivityAuthorizationInfo().areActivitiesEnabled
      }
      return false
    }

    AsyncFunction("startOrderActivity") {
      (orderId: String, attributes: ActivityAttributesRecord, initialState: ContentStateRecord) async throws -> String? in
      guard #available(iOS 16.2, *) else { return nil }
      let attrs = MandysOrderAttributes(
        kind: attributes.kind,
        orderNumber: attributes.orderNumber,
        waitText: attributes.waitText,
        storeLat: attributes.storeLat,
        storeLng: attributes.storeLng,
        destLat: attributes.destLat,
        destLng: attributes.destLng,
        mapImageFilename: nil // filled natively by the controller
      )
      return try await OrderActivityController.shared.start(
        orderId: orderId,
        attributes: attrs,
        state: Self.contentState(from: initialState)
      )
    }

    AsyncFunction("updateOrderActivity") {
      (orderId: String, state: ContentStateRecord) async -> Bool in
      guard #available(iOS 16.2, *) else { return false }
      return await OrderActivityController.shared.update(
        orderId: orderId,
        state: Self.contentState(from: state)
      )
    }

    AsyncFunction("endOrderActivity") {
      (orderId: String, finalState: ContentStateRecord?, immediateDismissal: Bool) async -> Bool in
      guard #available(iOS 16.2, *) else { return false }
      return await OrderActivityController.shared.end(
        orderId: orderId,
        state: finalState.map { Self.contentState(from: $0) },
        immediateDismissal: immediateDismissal
      )
    }
  }

  @available(iOS 16.2, *)
  private static func contentState(from record: ContentStateRecord) -> MandysOrderAttributes.ContentState {
    MandysOrderAttributes.ContentState(
      status: record.status,
      driverName: record.driverName,
      driverLat: record.driverLat,
      driverLng: record.driverLng,
      updatedAt: record.updatedAt
    )
  }
}
