// MandysOrderActivity widget extension entry point.
//
// One Activity type (MandysOrderAttributes); attributes.kind picks the
// pickup or delivery identity, and for delivery status==picked_up with a
// readable map snapshot the map-hero layout (S5/S5b) takes over.
// Dynamic Island follows mockup S7: system-black background, brand expressed
// only through content tints; compact = cup/scooter glyph + short status.

import ActivityKit
import SwiftUI
import WidgetKit

// The extension's deployment target is iOS 16.2 (expo-target.config.js), so
// the 16.2-only ActivityKit APIs need no runtime guards here; older devices
// simply never install/run the extension UI and the app-side bridge no-ops.
@main
struct OrderActivityWidgetBundle: WidgetBundle {
  var body: some Widget {
    MandysOrderLiveActivity()
  }
}

@available(iOS 16.2, *)
struct MandysOrderLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: MandysOrderAttributes.self) { context in
      OrderActivityLockScreenView(context: context)
        .activityBackgroundTint(Color.clear)
        .activitySystemActionForegroundColor(MandysColor.ink)
    } dynamicIsland: { context in
      let isPickup = context.attributes.kind == "pickup"
      let pickup = PickupPhase(status: context.state.status)
      let delivery = DeliveryPhase(status: context.state.status)

      return DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          Text(isPickup ? "🧋" : delivery.markEmoji)
            .font(.system(size: 15))
            .frame(width: 30, height: 30)
            .background(
              Circle().fill(
                isPickup
                  ? MandysColor.brand.opacity(0.35)
                  : MandysColor.sage.opacity(0.28)
              )
            )
        }
        DynamicIslandExpandedRegion(.trailing) {
          OrderNo(number: context.attributes.orderNumber, color: Color.white.opacity(0.4))
        }
        DynamicIslandExpandedRegion(.center) {
          VStack(spacing: 2) {
            Eyebrow(
              text: isPickup ? "Mandy's · Pickup" : "Mandy's · Delivery",
              color: isPickup ? Color(hex: 0xD8A978) : MandysColor.sage,
              size: 9
            )
            Text(
              isPickup
                ? pickup.heading
                : delivery.heading(driverName: context.state.driverName)
            )
            .font(.system(size: 17, weight: .semibold, design: .serif))
            .foregroundColor(.white)
            .lineLimit(1)
            .minimumScaleFactor(0.7)
          }
        }
        DynamicIslandExpandedRegion(.bottom) {
          if isPickup {
            VStack(spacing: 4) {
              // Wait estimate rides along in every pre-ready state.
              if let wait = context.attributes.waitText, !wait.isEmpty, !pickup.isDone {
                Text("\(pickup.sub) · \(wait)")
                  .font(.system(size: 10.5))
                  .foregroundColor(Color.white.opacity(0.55))
                  .lineLimit(1)
                  .minimumScaleFactor(0.8)
              }
              PickupStepsView(phase: pickup, onDark: true)
            }
            .padding(.top, 2)
          } else {
            DeliveryStepsView(
              stepIndex: delivery.stepIndex,
              completed: delivery == .delivered,
              palette: .island
            )
            .padding(.top, 2)
          }
        }
      } compactLeading: {
        Text(isPickup ? "🧋" : delivery.markEmoji)
          .font(.system(size: 12))
          .frame(width: 22, height: 22)
          .background(
            Circle().fill(
              isPickup ? MandysColor.brand.opacity(0.4) : MandysColor.sage.opacity(0.28)
            )
          )
      } compactTrailing: {
        HStack(spacing: 4) {
          Circle()
            .fill(compactDotColor(isPickup: isPickup, pickup: pickup, delivery: delivery))
            .frame(width: 6, height: 6)
          Text(
            isPickup
              ? compactPickupText(pickup, wait: context.attributes.waitText)
              : delivery.shortStatus
          )
            .font(.system(size: 11.5, weight: .bold))
            .foregroundColor(compactTextColor(isPickup: isPickup, pickup: pickup, delivery: delivery))
            .lineLimit(1)
            .minimumScaleFactor(0.75)
        }
      } minimal: {
        Text(isPickup ? "🧋" : delivery.markEmoji).font(.system(size: 12))
      }
    }
  }

  /// Three-state compact copy: "Order in" / "Making · ~X min" / "Ready!".
  private func compactPickupText(_ pickup: PickupPhase, wait: String?) -> String {
    if pickup == .preparing, let wait, !wait.isEmpty {
      return "\(pickup.shortStatus) · \(wait)"
    }
    return pickup.shortStatus
  }

  private func compactDotColor(isPickup: Bool, pickup: PickupPhase, delivery: DeliveryPhase) -> Color {
    if isPickup {
      switch pickup {
      case .received, .canceled: return MandysColor.amber
      case .preparing: return MandysColor.brand
      case .ready, .completed: return MandysColor.green
      }
    }
    return delivery == .delivered ? MandysColor.green : MandysColor.sage
  }

  private func compactTextColor(isPickup: Bool, pickup: PickupPhase, delivery: DeliveryPhase) -> Color {
    if isPickup {
      switch pickup {
      case .received, .canceled: return MandysColor.amberOnDark
      case .preparing: return Color(hex: 0xE5B87E)
      case .ready, .completed: return Color(hex: 0x7FD3A4)
      }
    }
    return delivery == .delivered ? Color(hex: 0x7FD3A4) : Color(hex: 0xCBDCB4)
  }
}

// MARK: - Lock screen layout selection

@available(iOS 16.2, *)
struct OrderActivityLockScreenView: View {
  let context: ActivityViewContext<MandysOrderAttributes>

  var body: some View {
    if context.attributes.kind == "pickup" {
      PickupCardView(context: context)
    } else if DeliveryPhase(status: context.state.status) == .pickedUp,
              let image = loadMapSnapshot() {
      DeliveryMapCardView(context: context, mapImage: image)
    } else {
      // finding / to-shop / delivered / canceled — and the no-snapshot
      // fallback for picked_up (S3/S4-style stepper layout).
      DeliveryCardView(context: context)
    }
  }

  private func loadMapSnapshot() -> UIImage? {
    guard let filename = context.attributes.mapImageFilename,
          !filename.isEmpty,
          let container = MandysAppGroup.containerURL()
    else { return nil }
    return UIImage(contentsOfFile: container.appendingPathComponent(filename).path)
  }
}
