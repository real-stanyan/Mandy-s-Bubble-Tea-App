// Parameterized cartoon drink cup — generalizes the original BobaCupView so
// every drink renders its own identity (liquid colour + top treatment +
// toppings) as pure SwiftUI shapes. Styles come from DrinkCatalog.swift;
// tuned against the real product photos in the macOS render harness.

import SwiftUI

// MARK: - Drink style model

@available(iOS 16.2, *)
enum TopTreatment {
  case milkFoam          // milk teas (visual no-op since the foam band was cut)
  case none              // clean tea surface (fresh brew / fruity teas)
  case slushDome         // blended icy mound above the rim (slushies / frappes)
  case cheeseCap         // thick pale cheese-foam cap (cheese cream)
}

@available(iOS 16.2, *)
struct DrinkStyle {
  var name: String
  var liquid: [Color]          // top→bottom body gradient
  var top: TopTreatment
  var boba: Bool
  var ice: Bool
  var straw: [Color] = [Color(hex: 0xB96A2B), Color(hex: 0x8D5524)]
  var domeColor: Color? = nil  // slush dome accent, defaults to liquid[0]
}

// MARK: - Tiny scaled cup for Dynamic Island slots

/// The full DrinkCupView scaled down to a small square slot (compact leading /
/// minimal / expanded leading). At these sizes the cup reads as silhouette +
/// liquid colour — exactly the per-drink identity the island needs.
@available(iOS 16.2, *)
struct DrinkCupGlyph: View {
  let style: DrinkStyle
  var size: CGFloat  // slot height (square)

  var body: some View {
    DrinkCupView(style: style)
      .frame(width: 74, height: 82)   // natural union bounds (halo ∪ cup)
      .scaleEffect(size / 82)
      .frame(width: size, height: size)
  }
}

// MARK: - Cup body shape (identical geometry to the original CupBodyShape)

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

// MARK: - Parameterized cup

@available(iOS 16.2, *)
struct DrinkCupView: View {
  let style: DrinkStyle
  var showBadge: Bool = false

  private var dome: Color { style.domeColor ?? style.liquid.first ?? .brown }

  var body: some View {
    ZStack {
      // soft halo
      Circle().fill(RadialGradient(
        colors: [dome.opacity(0.16), dome.opacity(0.05), .clear],
        center: .center, startRadius: 4, endRadius: 37))
        .frame(width: 74, height: 74)

      ZStack(alignment: .topLeading) {
        straw
        topMound        // slush dome ABOVE the rim (drawn behind lid/cup)
        lid
        cupBody
        iceCubes
        cheeseFoam
        bobaPearls
        if showBadge { badge }
      }
      .frame(width: 54, height: 82)
    }
  }

  // straw — every drink has one brown straw
  private var straw: some View {
    RoundedRectangle(cornerRadius: 3)
      .fill(LinearGradient(colors: style.straw, startPoint: .leading, endPoint: .trailing))
      .frame(width: 8, height: 34)
      .rotationEffect(.degrees(14), anchor: .bottom)
      .offset(x: 30, y: -7)
  }

  // lid — every drink has the flat dome lid
  private var lid: some View {
    RoundedRectangle(cornerRadius: 4)
      .fill(LinearGradient(colors: [Color(hex: 0xE8DAC6), Color(hex: 0xD9C3A3)],
                           startPoint: .top, endPoint: .bottom))
      .frame(width: 52, height: 7)
      .offset(x: 1, y: 12)
  }

  private var cupBody: some View {
    CupBodyShape()
      .fill(LinearGradient(colors: style.liquid, startPoint: .top, endPoint: .bottom))
      .frame(width: 48, height: 60)
      .offset(x: 3, y: 19)
  }

  @ViewBuilder private var topMound: some View {
    if style.top == .slushDome {
      // Rounded blended mound — an Ellipse (no sharp base corners) narrower
      // than the cup rim so its sides never poke out past the walls. Its
      // lower half is tucked behind the lid/cup, leaving a smooth cap.
      ZStack {
        Ellipse()
          .fill(LinearGradient(colors: [dome.opacity(0.95), dome],
                               startPoint: .top, endPoint: .bottom))
          .frame(width: 44, height: 30)
        // icy speckle (kept in the visible upper cap)
        ForEach(0..<6, id: \.self) { i in
          Circle().fill(Color.white.opacity(0.5))
            .frame(width: 3, height: 3)
            .offset(x: CGFloat([-12, -3, 7, 12, -8, 2][i]),
                    y: CGFloat([-11, -13, -9, -7, -6, -10][i]))
        }
      }.offset(x: 5, y: 1)
    }
  }

  // Thick white cheese-foam layer filling the TOP of the drink, drawn above
  // the cup body but kept INSIDE the cup walls (mirrors the real cheese-cream
  // drinks). A faint warm line marks where the foam meets the fruit drink.
  @ViewBuilder private var cheeseFoam: some View {
    if style.top == .cheeseCap {
      // Foam is the cup silhouette filled white, masked to just the top band —
      // so it spans wall-to-wall (no drink colour peeks above/beside it) and
      // never overflows the cup outline. `foamHeight` keeps the layer thin.
      let foamHeight: CGFloat = 17
      ZStack(alignment: .top) {
        CupBodyShape()
          .fill(LinearGradient(colors: [Color(hex: 0xFDFBF5), Color(hex: 0xF1E6CE)],
                               startPoint: .top, endPoint: .bottom))
          .frame(width: 48, height: 60)
          .mask(
            VStack(spacing: 0) {
              Rectangle().frame(height: foamHeight)
              Spacer(minLength: 0)
            }
          )
        RoundedRectangle(cornerRadius: 1.5)
          .fill(Color(hex: 0xE7D3B0).opacity(0.5))
          .frame(width: 40, height: 2)
          .offset(y: foamHeight - 1)
      }
      .frame(width: 48, height: 60, alignment: .top)
      .offset(x: 3, y: 19)
    }
  }

  @ViewBuilder private var iceCubes: some View {
    if style.ice {
      ForEach(0..<3, id: \.self) { i in
        RoundedRectangle(cornerRadius: 2)
          .fill(Color.white.opacity(0.35))
          .frame(width: 10, height: 10)
          .rotationEffect(.degrees([18, -12, 8][i]))
          .offset(x: CGFloat([10, 26, 18][i]), y: CGFloat([30, 34, 46][i]))
      }
    }
  }

  @ViewBuilder private var bobaPearls: some View {
    if style.boba {
      let pts: [(CGFloat, CGFloat)] = [(13, 69), (24, 70), (35, 69), (18, 62), (30, 62)]
      ForEach(0..<pts.count, id: \.self) { i in
        Circle().fill(RadialGradient(
          colors: [Color(hex: 0x6B4A2B), Color(hex: 0x3A2413)],
          center: UnitPoint(x: 0.32, y: 0.28), startRadius: 0, endRadius: 5))
          .frame(width: 7, height: 7)
          .offset(x: pts[i].0, y: pts[i].1)
      }
    }
  }

  private var badge: some View {
    ZStack {
      Circle().fill(MandysColor.green)
      Text("✓").font(.system(size: 12, weight: .heavy)).foregroundColor(.white)
    }
    .frame(width: 24, height: 24)
    .overlay(Circle().stroke(MandysColor.paper, lineWidth: 3))
    .offset(x: 40, y: 2)
  }
}
