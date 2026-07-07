// Pickup lock-screen card — 3 states, each with its own card tone:
//   received  → cream base + AMBER accents (waiting: staff haven't accepted)
//   preparing → cream base + BRAND brown accents (original S1)
//   ready     → green takeover (original S2)
// Warm cream identity throughout: boba-cup hero on the left, 3-step progress
// (Received → Preparing → Ready) along the bottom. The stepper derives purely
// from the phase, so the shop skipping accept (received → ready, no RESERVED
// in between) just renders as everything done.

import SwiftUI
import WidgetKit
import ActivityKit

/// Per-phase accent palette for the pickup card + stepper.
@available(iOS 16.2, *)
struct PickupAccent {
  /// Eyebrow + active-label text (dark enough for cream backgrounds).
  let text: Color
  /// Active node / progress fill / pill dot.
  let node: Color
  /// Glow ring around the active node.
  let glow: Color
  /// Progress-bar gradient for the in-progress segment.
  let barFill: LinearGradient

  static func accent(for phase: PickupPhase) -> PickupAccent {
    switch phase {
    case .received, .canceled:
      return PickupAccent(
        text: MandysColor.amberDark,
        node: MandysColor.amber,
        glow: MandysColor.amber.opacity(0.22),
        barFill: LinearGradient(
          colors: [MandysColor.amber, Color(hex: 0xD9B54A)],
          startPoint: .leading, endPoint: .trailing
        )
      )
    case .preparing:
      return PickupAccent(
        text: MandysColor.brandDark,
        node: MandysColor.brand,
        glow: MandysColor.brand.opacity(0.18),
        barFill: LinearGradient(
          colors: [MandysColor.brand, MandysColor.brandLight],
          startPoint: .leading, endPoint: .trailing
        )
      )
    case .ready, .completed:
      return PickupAccent(
        text: MandysColor.greenDark,
        node: MandysColor.green,
        glow: MandysColor.green.opacity(0.2),
        barFill: LinearGradient(
          colors: [MandysColor.green, MandysColor.greenDark],
          startPoint: .leading, endPoint: .trailing
        )
      )
    }
  }
}

@available(iOS 16.2, *)
struct PickupCardView: View {
  let context: ActivityViewContext<MandysOrderAttributes>

  private var phase: PickupPhase { PickupPhase(status: context.state.status) }

  var body: some View {
    let ready = phase.isDone
    let accent = PickupAccent.accent(for: phase)
    HStack(alignment: .center, spacing: 12) {
      // Cartoon cup matching the ordered drink (first item); unknown/legacy
      // activities without drinkName fall back to the classic brown cup.
      DrinkCupView(
        style: DrinkCatalog.style(for: context.attributes.drinkName),
        showBadge: ready
      )
      .frame(width: 78)

      VStack(alignment: .leading, spacing: 0) {
        HStack(alignment: .firstTextBaseline) {
          Eyebrow(text: "Mandy's · Pickup", color: accent.text)
          Spacer(minLength: 6)
          OrderNo(number: context.attributes.orderNumber, color: MandysColor.ink3)
        }

        Text(phase.heading)
          .font(.system(size: 21, weight: .semibold, design: .serif))
          .foregroundColor(ready ? MandysColor.readyHeading : MandysColor.ink)
          .lineLimit(1)
          .minimumScaleFactor(0.7)
          .padding(.top, 5)

        subRow(ready: ready, accent: accent)
          .padding(.top, 3)

        Spacer(minLength: 4)

        PickupStepsView(phase: phase)
      }
    }
    .padding(EdgeInsets(top: 14, leading: 14, bottom: 12, trailing: 16))
    .frame(height: 152)
    .background(background)
  }

  @ViewBuilder
  private func subRow(ready: Bool, accent: PickupAccent) -> some View {
    HStack(spacing: 6) {
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
        Text(phase.sub)
          .font(.system(size: 11.5))
          .foregroundColor(MandysColor.ink2)
          .lineLimit(1)
          .minimumScaleFactor(0.85)
      }
      // Wait-estimate pill: shown in ALL three states whenever the estimate
      // exists, tinted with the phase accent.
      if let wait = context.attributes.waitText, !wait.isEmpty {
        HStack(spacing: 4) {
          Circle().fill(accent.node).frame(width: 5, height: 5)
          Text(wait)
            .font(.system(size: 10, weight: .bold, design: .monospaced))
            .foregroundColor(accent.text)
        }
        .padding(.horizontal, 9)
        .padding(.vertical, 2.5)
        .background(
          Capsule()
            .fill(accent.node.opacity(0.12))
            .overlay(Capsule().stroke(accent.node.opacity(0.26), lineWidth: 1))
        )
      }
    }
  }

  private var background: LinearGradient {
    switch phase {
    case .ready, .completed:
      return LinearGradient(
        colors: [MandysColor.paper, MandysColor.readyBg1, MandysColor.readyBg2],
        startPoint: .topLeading, endPoint: .bottomTrailing
      )
    case .received, .canceled:
      // Same warm cream family, but the bottom stop leans golden-amber so
      // the waiting card reads distinctly from the brown "preparing" card.
      return LinearGradient(
        colors: [MandysColor.paper, MandysColor.cream, MandysColor.receivedCream],
        startPoint: .topLeading, endPoint: .bottomTrailing
      )
    case .preparing:
      return LinearGradient(
        colors: [MandysColor.paper, MandysColor.cream, MandysColor.creamDeep],
        startPoint: .topLeading, endPoint: .bottomTrailing
      )
    }
  }
}

// MARK: - 3-step progress (Received → Preparing → Ready)

@available(iOS 16.2, *)
struct PickupStepsView: View {
  let phase: PickupPhase
  /// Dynamic-Island dark variant.
  var onDark: Bool = false

  private static let labels = ["Received", "Preparing", "Ready"]

  var body: some View {
    let accent = PickupAccent.accent(for: phase)
    let idx = phase.stepIndex
    let done = phase.isDone
    VStack(spacing: 4) {
      HStack(spacing: 5) {
        ForEach(0..<3) { i in
          node(i, idx: idx, done: done, accent: accent)
          if i < 2 { bar(i, idx: idx, done: done, accent: accent) }
        }
      }
      HStack(spacing: 0) {
        ForEach(0..<3) { i in
          Text(Self.labels[i])
            .font(.system(size: 9, weight: .semibold))
            .foregroundColor(labelColor(i, idx: idx, done: done, accent: accent))
            .frame(
              maxWidth: .infinity,
              alignment: i == 0 ? .leading : i == 2 ? .trailing : .center
            )
            .lineLimit(1)
            .minimumScaleFactor(0.8)
        }
      }
    }
  }

  private func visual(_ i: Int, idx: Int, done: Bool) -> (done: Bool, active: Bool) {
    (done: done ? true : i < idx, active: !done && i == idx)
  }

  @ViewBuilder
  private func node(_ i: Int, idx: Int, done: Bool, accent: PickupAccent) -> some View {
    let v = visual(i, idx: idx, done: done)
    ZStack {
      Circle()
        .fill(
          v.done ? MandysColor.green
            : v.active ? accent.node
            : (onDark ? Color.white.opacity(0.2) : MandysColor.ink.opacity(0.14))
        )
      if v.done {
        Text("✓").font(.system(size: 9, weight: .heavy)).foregroundColor(.white)
      } else if v.active {
        Circle().fill(Color.white).frame(width: 5, height: 5)
      }
    }
    .frame(width: 17, height: 17)
    .background(
      Circle()
        .fill(v.active ? accent.glow : Color.clear)
        .frame(width: 25, height: 25)
    )
  }

  /// Bar i connects node i → node i+1. Segments the customer has fully
  /// passed are green; the segment leading OUT of the active node gets the
  /// mock's 42% "in-progress" fill in the phase accent.
  @ViewBuilder
  private func bar(_ i: Int, idx: Int, done: Bool, accent: PickupAccent) -> some View {
    let fullyDone = done || i + 1 <= idx
    let inProgress = !done && i == idx
    GeometryReader { geo in
      ZStack(alignment: .leading) {
        Capsule()
          .fill(onDark ? Color.white.opacity(0.14) : MandysColor.ink.opacity(0.12))
        if fullyDone {
          Capsule()
            .fill(
              LinearGradient(
                colors: [MandysColor.green, MandysColor.greenDark],
                startPoint: .leading, endPoint: .trailing
              )
            )
        } else if inProgress {
          Capsule()
            .fill(accent.barFill)
            .frame(width: geo.size.width * 0.42)
        }
      }
    }
    .frame(height: 4)
  }

  private func labelColor(_ i: Int, idx: Int, done: Bool, accent: PickupAccent) -> Color {
    let v = visual(i, idx: idx, done: done)
    if v.done { return onDark ? MandysColor.green : MandysColor.greenDark }
    if v.active { return onDark ? onDarkAccentText : accent.text }
    return onDark ? Color.white.opacity(0.45) : MandysColor.ink3
  }

  private var onDarkAccentText: Color {
    phase == .received ? MandysColor.amberOnDark : Color(hex: 0xE5B87E)
  }
}

// The pure-shape boba cup (BobaCupView + CupBodyShape) moved to
// DrinkCup.swift as the parameterized DrinkCupView, styled per drink by
// DrinkCatalog.swift.
