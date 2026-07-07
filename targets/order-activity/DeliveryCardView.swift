// Delivery lock-screen stepper card (mockup S3 finding / S4 to-shop /
// S6 delivered / canceled), and the shared 4-step route stepper.
// Deep-sage identity; delivered flips to the green celebration gradient.
// This card is also the fallback for picked_up when no map snapshot exists.

import SwiftUI
import WidgetKit
import ActivityKit

// MARK: - Stepper palette

@available(iOS 16.2, *)
struct DeliveryStepperPalette {
  var nodeTodo: Color
  var nodeDone: Color
  var nodeDoneMark: Color
  var nodeActive: Color
  var nodeActiveCore: Color
  var nodeActiveGlow: Color
  var barLit: LinearGradient
  var barRoute: Color
  var label: Color
  var labelOn: Color
  var labelDone: Color

  static let dark = DeliveryStepperPalette(
    nodeTodo: MandysColor.deliveryText.opacity(0.16),
    nodeDone: MandysColor.sage,
    nodeDoneMark: Color(hex: 0x223026),
    nodeActive: MandysColor.amber,
    nodeActiveCore: Color(hex: 0x2A2410),
    nodeActiveGlow: MandysColor.amber.opacity(0.22),
    barLit: LinearGradient(colors: [MandysColor.sage, MandysColor.sageDeep], startPoint: .leading, endPoint: .trailing),
    barRoute: MandysColor.deliveryText.opacity(0.28),
    label: MandysColor.deliveryText.opacity(0.45),
    labelOn: MandysColor.amber,
    labelDone: MandysColor.sage
  )

  static let celebration = DeliveryStepperPalette(
    nodeTodo: Color.white.opacity(0.2),
    nodeDone: MandysColor.paper,
    nodeDoneMark: MandysColor.greenDark,
    nodeActive: MandysColor.paper,
    nodeActiveCore: MandysColor.greenDark,
    nodeActiveGlow: Color.white.opacity(0.3),
    barLit: LinearGradient(colors: [MandysColor.paper, MandysColor.paper], startPoint: .leading, endPoint: .trailing),
    barRoute: Color.white.opacity(0.2),
    label: Color.white.opacity(0.75),
    labelOn: .white,
    labelDone: .white
  )

  /// Dynamic-Island (system black background) variant.
  static let island = DeliveryStepperPalette(
    nodeTodo: Color.white.opacity(0.2),
    nodeDone: MandysColor.sage,
    nodeDoneMark: Color(hex: 0x223026),
    nodeActive: Color(hex: 0xCBDCB4),
    nodeActiveCore: Color(hex: 0x33402F),
    nodeActiveGlow: Color(hex: 0xCBDCB4).opacity(0.22),
    barLit: LinearGradient(colors: [MandysColor.sage, MandysColor.sageDeep], startPoint: .leading, endPoint: .trailing),
    barRoute: Color.white.opacity(0.28),
    label: Color.white.opacity(0.4),
    labelOn: Color(hex: 0xCBDCB4),
    labelDone: MandysColor.sage
  )
}

// MARK: - 4-step route stepper

@available(iOS 16.2, *)
struct DeliveryStepsView: View {
  /// Highest reached step 0–3 (mirrors lib/dispatch-steps.ts stepVisual()).
  let stepIndex: Int
  let completed: Bool
  var palette: DeliveryStepperPalette = .dark
  var showLabels: Bool = true

  var body: some View {
    VStack(spacing: 5) {
      HStack(spacing: 4) {
        ForEach(0..<4) { i in
          node(i)
          if i < 3 { bar(litLeftOf: i + 1) }
        }
      }
      if showLabels {
        HStack(spacing: 0) {
          ForEach(0..<4) { i in
            Text(DeliveryPhase.stepLabels[i])
              .font(.system(size: 8, weight: .semibold))
              .foregroundColor(labelColor(i))
              .frame(maxWidth: .infinity, alignment: i == 0 ? .leading : i == 3 ? .trailing : .center)
              .lineLimit(1)
              .minimumScaleFactor(0.8)
          }
        }
      }
    }
  }

  private func visual(_ i: Int) -> (done: Bool, active: Bool) {
    (done: completed ? true : i < stepIndex, active: !completed && i == stepIndex)
  }

  @ViewBuilder
  private func node(_ i: Int) -> some View {
    let v = visual(i)
    ZStack {
      Circle().fill(v.done ? palette.nodeDone : v.active ? palette.nodeActive : palette.nodeTodo)
      if v.done {
        Text("✓").font(.system(size: 8, weight: .heavy)).foregroundColor(palette.nodeDoneMark)
      } else if v.active {
        Circle().fill(palette.nodeActiveCore).frame(width: 5, height: 5)
      }
    }
    .frame(width: 15, height: 15)
    .background(
      Circle()
        .fill(visual(i).active ? palette.nodeActiveGlow : Color.clear)
        .frame(width: 23, height: 23)
    )
  }

  @ViewBuilder
  private func bar(litLeftOf next: Int) -> some View {
    let lit = completed ? true : next <= stepIndex
    Group {
      if lit {
        Capsule().fill(palette.barLit).frame(height: 3.5)
      } else {
        DashedLine(color: palette.barRoute).frame(height: 2.5)
      }
    }
    .frame(maxWidth: .infinity)
  }

  private func labelColor(_ i: Int) -> Color {
    let v = visual(i)
    if completed { return palette.labelDone }
    if v.active { return palette.labelOn }
    if v.done { return palette.labelDone }
    return palette.label
  }
}

/// The "route ahead" dashed connector texture.
@available(iOS 16.2, *)
struct DashedLine: View {
  let color: Color

  var body: some View {
    GeometryReader { geo in
      Path { p in
        p.move(to: CGPoint(x: 0, y: geo.size.height / 2))
        p.addLine(to: CGPoint(x: geo.size.width, y: geo.size.height / 2))
      }
      .stroke(color, style: StrokeStyle(lineWidth: geo.size.height, dash: [5, 5]))
    }
  }
}

// MARK: - Lock-screen delivery card

@available(iOS 16.2, *)
struct DeliveryCardView: View {
  let context: ActivityViewContext<MandysOrderAttributes>

  private var phase: DeliveryPhase { DeliveryPhase(status: context.state.status) }

  var body: some View {
    let delivered = phase == .delivered
    ZStack(alignment: .topTrailing) {
      if delivered {
        // celebration sparkles
        Text("✦").font(.system(size: 13)).foregroundColor(.white.opacity(0.9))
          .offset(x: -48, y: 23)
        Text("✧").font(.system(size: 11)).foregroundColor(.white.opacity(0.9))
          .offset(x: -20, y: 35)
        Text("✦").font(.system(size: 10)).foregroundColor(.white.opacity(0.9))
          .offset(x: -38, y: 53)
      }

      VStack(alignment: .leading, spacing: 0) {
        HStack(spacing: 8) {
          Text(phase.markEmoji)
            .font(.system(size: 13))
            .frame(width: 26, height: 26)
            .background(
              RoundedRectangle(cornerRadius: 9)
                .fill(delivered ? Color.white.opacity(0.18) : MandysColor.deliveryText.opacity(0.12))
                .overlay(
                  RoundedRectangle(cornerRadius: 9)
                    .stroke(delivered ? Color.white.opacity(0.25) : MandysColor.deliveryText.opacity(0.18), lineWidth: 1)
                )
            )
          Eyebrow(
            text: "Mandy's · Delivery",
            color: delivered ? Color(hex: 0xBFE9CF) : MandysColor.sage
          )
          Spacer(minLength: 6)
          OrderNo(
            number: context.attributes.orderNumber,
            color: delivered ? Color.white.opacity(0.6) : MandysColor.deliveryText.opacity(0.5)
          )
        }

        Text(phase.heading(driverName: context.state.driverName))
          .font(.system(size: 19, weight: .semibold, design: .serif))
          .foregroundColor(delivered ? .white : MandysColor.deliveryHeading)
          .lineLimit(1)
          .minimumScaleFactor(0.7)
          .padding(.top, 7)

        Text(phase.sub(driverName: context.state.driverName))
          .font(.system(size: 11))
          .foregroundColor(delivered ? Color.white.opacity(0.85) : MandysColor.deliveryText.opacity(0.68))
          .lineLimit(1)
          .truncationMode(.tail)
          .padding(.top, 2)

        Spacer(minLength: 4)

        DeliveryStepsView(
          stepIndex: phase.stepIndex,
          completed: delivered,
          palette: delivered ? .celebration : .dark
        )
      }
      .padding(EdgeInsets(top: 13, leading: 16, bottom: 12, trailing: 16))
    }
    // Match the map card: full 160pt lock-screen height.
    .frame(height: 160)
    .background(background(delivered: delivered))
  }

  @ViewBuilder
  private func background(delivered: Bool) -> some View {
    if delivered {
      ZStack {
        LinearGradient(
          colors: [MandysColor.green, Color(hex: 0x35935F), MandysColor.greenDark],
          startPoint: .topLeading, endPoint: .bottomTrailing
        )
        RadialGradient(
          colors: [MandysColor.paper.opacity(0.22), .clear],
          center: UnitPoint(x: 0.85, y: -0.15), startRadius: 0, endRadius: 200
        )
      }
    } else {
      ZStack {
        LinearGradient(
          colors: [MandysColor.deliveryBg1, MandysColor.deliveryBg2, MandysColor.deliveryBg3],
          startPoint: .topLeading, endPoint: .bottomTrailing
        )
        RadialGradient(
          colors: [MandysColor.amber.opacity(0.16), .clear],
          center: UnitPoint(x: 0.88, y: -0.1), startRadius: 0, endRadius: 180
        )
      }
    }
  }
}
