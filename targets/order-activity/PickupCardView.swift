// Pickup lock-screen card (mockup S1 preparing / S2 ready).
// Warm cream identity: paper→cream gradient, brown ink, boba-cup hero on the
// left, 2-step progress (Preparing → Ready) along the bottom.

import SwiftUI
import WidgetKit
import ActivityKit

@available(iOS 16.2, *)
struct PickupCardView: View {
  let context: ActivityViewContext<MandysOrderAttributes>

  private var phase: PickupPhase { PickupPhase(status: context.state.status) }

  var body: some View {
    let ready = phase.isDone
    HStack(alignment: .center, spacing: 12) {
      BobaCupView(showBadge: ready)
        .frame(width: 78)

      VStack(alignment: .leading, spacing: 0) {
        HStack(alignment: .firstTextBaseline) {
          Eyebrow(text: "Mandy's · Pickup", color: ready ? MandysColor.greenDark : MandysColor.brand)
          Spacer(minLength: 6)
          OrderNo(number: context.attributes.orderNumber, color: MandysColor.ink3)
        }

        Text(phase.heading)
          .font(.system(size: 21, weight: .semibold, design: .serif))
          .foregroundColor(ready ? MandysColor.readyHeading : MandysColor.ink)
          .lineLimit(1)
          .minimumScaleFactor(0.7)
          .padding(.top, 5)

        subRow(ready: ready)
          .padding(.top, 3)

        Spacer(minLength: 4)

        PickupStepsView(phase: phase)
      }
    }
    .padding(EdgeInsets(top: 14, leading: 14, bottom: 12, trailing: 16))
    .frame(height: 152)
    .background(background(ready: ready))
  }

  @ViewBuilder
  private func subRow(ready: Bool) -> some View {
    if ready {
      HStack(spacing: 5) {
        Text("📍").font(.system(size: 10))
        Text("Mandy's Bubble Tea")
          .font(.system(size: 10.5, weight: .semibold))
          .foregroundColor(MandysColor.ink2)
      }
      .padding(.horizontal, 9)
      .padding(.vertical, 2.5)
      .background(
        Capsule()
          .fill(Color.white.opacity(0.75))
          .overlay(Capsule().stroke(MandysColor.greenDark.opacity(0.22), lineWidth: 1))
      )
    } else {
      HStack(spacing: 6) {
        Text(phase.sub)
          .font(.system(size: 11.5))
          .foregroundColor(MandysColor.ink2)
          .lineLimit(1)
        if let wait = context.attributes.waitText, !wait.isEmpty {
          HStack(spacing: 4) {
            Circle().fill(MandysColor.amber).frame(width: 5, height: 5)
            Text(wait)
              .font(.system(size: 10, weight: .bold, design: .monospaced))
              .foregroundColor(MandysColor.brandDark)
          }
          .padding(.horizontal, 9)
          .padding(.vertical, 2.5)
          .background(
            Capsule()
              .fill(MandysColor.brand.opacity(0.12))
              .overlay(Capsule().stroke(MandysColor.brand.opacity(0.22), lineWidth: 1))
          )
        }
      }
    }
  }

  private func background(ready: Bool) -> LinearGradient {
    if ready {
      return LinearGradient(
        colors: [MandysColor.paper, MandysColor.readyBg1, MandysColor.readyBg2],
        startPoint: .topLeading, endPoint: .bottomTrailing
      )
    }
    return LinearGradient(
      colors: [MandysColor.paper, MandysColor.cream, MandysColor.creamDeep],
      startPoint: .topLeading, endPoint: .bottomTrailing
    )
  }
}

// MARK: - 2-step progress (Preparing → Ready)

@available(iOS 16.2, *)
struct PickupStepsView: View {
  let phase: PickupPhase
  /// Dynamic-Island dark variant.
  var onDark: Bool = false

  var body: some View {
    let done = phase.isDone
    VStack(spacing: 4) {
      HStack(spacing: 5) {
        node(done: done, active: !done)
        GeometryReader { geo in
          ZStack(alignment: .leading) {
            Capsule()
              .fill(onDark ? Color.white.opacity(0.14) : MandysColor.ink.opacity(0.12))
            Capsule()
              .fill(
                done
                  ? LinearGradient(colors: [MandysColor.green, MandysColor.greenDark], startPoint: .leading, endPoint: .trailing)
                  : LinearGradient(colors: [MandysColor.brand, MandysColor.brandLight], startPoint: .leading, endPoint: .trailing)
              )
              .frame(width: geo.size.width * (done ? 1 : 0.42))
          }
        }
        .frame(height: 4)
        node(done: done, active: false)
      }
      HStack {
        Text("Preparing")
          .foregroundColor(labelColor(active: !done, done: done))
        Spacer()
        Text("Ready")
          .foregroundColor(labelColor(active: false, done: done))
      }
      .font(.system(size: 9, weight: .semibold))
    }
  }

  @ViewBuilder
  private func node(done: Bool, active: Bool) -> some View {
    ZStack {
      Circle()
        .fill(
          done ? MandysColor.green
            : active ? MandysColor.brand
            : (onDark ? Color.white.opacity(0.2) : MandysColor.ink.opacity(0.14))
        )
      if done {
        Text("✓").font(.system(size: 9, weight: .heavy)).foregroundColor(.white)
      } else if active {
        Circle().fill(Color.white).frame(width: 5, height: 5)
      }
    }
    .frame(width: 17, height: 17)
    .background(
      Circle()
        .fill(active ? MandysColor.brand.opacity(0.18) : Color.clear)
        .frame(width: 25, height: 25)
    )
  }

  private func labelColor(active: Bool, done: Bool) -> Color {
    if done { return onDark ? MandysColor.green : MandysColor.greenDark }
    if active { return onDark ? Color(hex: 0xE5B87E) : MandysColor.brandDark }
    return onDark ? Color.white.opacity(0.45) : MandysColor.ink3
  }
}

// MARK: - Pure-shape boba cup (mockup's CSS cup, in SwiftUI)

@available(iOS 16.2, *)
struct BobaCupView: View {
  var showBadge: Bool

  var body: some View {
    ZStack {
      // halo
      Circle()
        .fill(
          RadialGradient(
            colors: [MandysColor.brand.opacity(0.16), MandysColor.brand.opacity(0.05), .clear],
            center: .center, startRadius: 4, endRadius: 37
          )
        )
        .frame(width: 74, height: 74)

      ZStack(alignment: .topLeading) {
        // straw
        RoundedRectangle(cornerRadius: 3)
          .fill(LinearGradient(colors: [Color(hex: 0xB96A2B), MandysColor.brand], startPoint: .leading, endPoint: .trailing))
          .frame(width: 8, height: 34)
          .rotationEffect(.degrees(14), anchor: .bottom)
          .offset(x: 30, y: -7)
        // lid
        RoundedRectangle(cornerRadius: 4)
          .fill(LinearGradient(colors: [Color(hex: 0xE8DAC6), Color(hex: 0xD9C3A3)], startPoint: .top, endPoint: .bottom))
          .frame(width: 52, height: 7)
          .offset(x: 1, y: 12)
        // body (tapered cup)
        CupBodyShape()
          .fill(
            LinearGradient(
              colors: [Color(hex: 0xF3DDBB), Color(hex: 0xE5B87E), Color(hex: 0xC98A4B), Color(hex: 0xB5763B)],
              startPoint: .top, endPoint: .bottom
            )
          )
          .frame(width: 48, height: 60)
          .offset(x: 3, y: 19)
        // foam
        RoundedRectangle(cornerRadius: 8)
          .fill(LinearGradient(colors: [MandysColor.paper.opacity(0.95), MandysColor.cream.opacity(0.35)], startPoint: .top, endPoint: .bottom))
          .frame(width: 42, height: 12)
          .offset(x: 6, y: 21)
        // shine
        Capsule()
          .fill(Color.white.opacity(0.45))
          .frame(width: 5, height: 34)
          .rotationEffect(.degrees(3))
          .offset(x: 9, y: 26)
        // pearls
        pearl.offset(x: 13, y: 69)
        pearl.offset(x: 24, y: 70)
        pearl.offset(x: 35, y: 69)
        pearl.offset(x: 18, y: 62)
        pearl.offset(x: 30, y: 62)

        if showBadge {
          ZStack {
            Circle().fill(MandysColor.green)
            Text("✓").font(.system(size: 12, weight: .heavy)).foregroundColor(.white)
          }
          .frame(width: 24, height: 24)
          .overlay(Circle().stroke(MandysColor.paper, lineWidth: 3))
          .offset(x: 40, y: 2)
        }
      }
      .frame(width: 54, height: 82)
    }
  }

  private var pearl: some View {
    Circle()
      .fill(
        RadialGradient(
          colors: [Color(hex: 0x6B4A2B), Color(hex: 0x3A2413)],
          center: UnitPoint(x: 0.32, y: 0.28), startRadius: 0, endRadius: 5
        )
      )
      .frame(width: 7, height: 7)
  }
}

@available(iOS 16.2, *)
struct CupBodyShape: Shape {
  func path(in rect: CGRect) -> Path {
    var p = Path()
    let topInset = rect.width * 0.04
    let bottomInset = rect.width * 0.16
    let r: CGFloat = 8
    p.move(to: CGPoint(x: rect.minX + topInset, y: rect.minY))
    p.addLine(to: CGPoint(x: rect.maxX - topInset, y: rect.minY))
    p.addLine(to: CGPoint(x: rect.maxX - bottomInset + 2, y: rect.maxY - r))
    p.addQuadCurve(
      to: CGPoint(x: rect.maxX - bottomInset - r, y: rect.maxY),
      control: CGPoint(x: rect.maxX - bottomInset, y: rect.maxY)
    )
    p.addLine(to: CGPoint(x: rect.minX + bottomInset + r, y: rect.maxY))
    p.addQuadCurve(
      to: CGPoint(x: rect.minX + bottomInset - 2, y: rect.maxY - r),
      control: CGPoint(x: rect.minX + bottomInset, y: rect.maxY)
    )
    p.closeSubpath()
    return p
  }
}
