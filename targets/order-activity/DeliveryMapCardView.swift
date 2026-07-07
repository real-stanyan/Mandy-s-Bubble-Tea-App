// Delivery out-for-delivery map-hero card (mockup S5 live / S5b paused).
//
// Top ~110pt: static MKMapSnapshotter PNG pre-rendered at order time into the
// App Group container (attributes.mapImageFilename); the widget re-derives
// the SAME padded/aspect-corrected bbox from the attributes' store/dest
// coordinates (GeoProjection — twinned with the app-side snapshot region),
// so the store/home pins and the pushed driverLat/Lng project onto the image
// with plain percentage math. No live map, no web content.
//
// Bottom strip: sage gradient (in-app identity) with heading + straight-line
// distance sub + mini 4-dot stepper. `context.isStale` (staleDate = push
// time + 90s) flips the whole card into the amber PAUSED degradation.

import SwiftUI
import WidgetKit
import ActivityKit

@available(iOS 16.2, *)
struct DeliveryMapCardView: View {
  let context: ActivityViewContext<MandysOrderAttributes>
  let mapImage: UIImage

  private var paused: Bool { context.isStale }

  private var bbox: GeoProjection.BBox? {
    guard let sLat = context.attributes.storeLat, let sLng = context.attributes.storeLng,
          let dLat = context.attributes.destLat, let dLng = context.attributes.destLng
    else { return nil }
    return GeoProjection.bbox(lat1: sLat, lng1: sLng, lat2: dLat, lng2: dLng)
  }

  var body: some View {
    VStack(spacing: 0) {
      mapZone
        .frame(height: 110)
        .clipped()
      lowerStrip
        .frame(maxHeight: .infinity)
    }
    // Lock-screen activities cap at 160pt — use all of it, and give the map
    // the extra headroom (the strip below only needs ~50pt).
    .frame(height: 160)
    .background(Color(hex: 0xF2EFE6))
  }

  // MARK: map zone

  private var mapZone: some View {
    GeometryReader { geo in
      let box = bbox
      let store = point(context.attributes.storeLat, context.attributes.storeLng, box, geo.size)
      let home = point(context.attributes.destLat, context.attributes.destLng, box, geo.size)
      let rider = point(context.state.driverLat, context.state.driverLng, box, geo.size)

      ZStack(alignment: .topLeading) {
        Image(uiImage: mapImage)
          .resizable()
          .scaledToFill()
          .frame(width: geo.size.width, height: geo.size.height)
          .clipped()

        // route: traveled (store→rider) solid sage, remaining (rider→dest) dashed
        if let store, let home {
          let mid = rider
          RoutePath(from: store, mid: mid, to: home, traveled: true)
            .stroke(
              MandysColor.sageDeep,
              style: StrokeStyle(lineWidth: 3.5, lineCap: .round)
            )
          RoutePath(from: store, mid: mid, to: home, traveled: false)
            .stroke(
              paused ? Color(hex: 0xBDB8A9) : MandysColor.sageDeep,
              style: StrokeStyle(lineWidth: 3, lineCap: .round, dash: [1.5, 7])
            )
        }

        if let store {
          pin(emoji: "🧋", fill: MandysColor.brand).position(store)
        }
        if let home {
          pin(emoji: "🏠", fill: MandysColor.green).position(home)
        }
        if let rider {
          riderMarker.position(rider)
        }

        // top-left translucent eyebrow pill
        HStack(spacing: 7) {
          Eyebrow(text: "Mandy's · Delivery", color: MandysColor.brand, size: 8.5)
          OrderNo(number: context.attributes.orderNumber, color: MandysColor.ink3, size: 9)
        }
        .padding(.horizontal, 9)
        .padding(.vertical, 3)
        .background(Capsule().fill(Color.white.opacity(0.88)))
        .offset(x: 10, y: 8)

        // LIVE / PAUSED chip top-right
        HStack(spacing: 4) {
          Circle()
            .fill(paused ? MandysColor.amber : MandysColor.green)
            .frame(width: 6, height: 6)
          Text(paused ? "PAUSED" : "LIVE")
            .font(.system(size: 8.5, weight: .heavy, design: .monospaced))
            .tracking(1.1)
            .foregroundColor(paused ? Color(hex: 0x8A6E14) : MandysColor.greenDark)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 3)
        .background(Capsule().fill(Color.white.opacity(0.92)))
        .frame(maxWidth: .infinity, alignment: .trailing)
        .padding(.trailing, 10)
        .offset(y: 8)

        // fade into the sage strip
        VStack {
          Spacer()
          LinearGradient(
            colors: [.clear, MandysColor.liveSage2.opacity(0.85)],
            startPoint: .top, endPoint: .bottom
          )
          .frame(height: 18)
        }
      }
    }
  }

  private func point(
    _ lat: Double?, _ lng: Double?,
    _ box: GeoProjection.BBox?, _ size: CGSize
  ) -> CGPoint? {
    guard let lat, let lng, let box else { return nil }
    let p = GeoProjection.project(lat: lat, lng: lng, in: box)
    // clamp so a slightly out-of-bbox point never escapes the card
    let x = min(max(p.x, 0.05), 0.95) * size.width
    let y = min(max(p.y, 0.1), 0.9) * size.height
    return CGPoint(x: x, y: y)
  }

  private func pin(emoji: String, fill: Color) -> some View {
    Text(emoji)
      .font(.system(size: 12))
      .frame(width: 26, height: 26)
      .background(Circle().fill(fill))
      .overlay(Circle().stroke(Color.white, lineWidth: 2))
      .shadow(color: .black.opacity(0.25), radius: 2.5, y: 2)
  }

  private var riderMarker: some View {
    Text("🛵")
      .font(.system(size: 18))
      .scaleEffect(x: -1)
      .frame(width: 36, height: 36)
      .background(Circle().fill(MandysColor.paper))
      .overlay(Circle().stroke(paused ? MandysColor.amber : Color.white, lineWidth: 2.5))
      .shadow(color: .black.opacity(0.3), radius: 4.5, y: 4)
      .opacity(paused ? 0.55 : 1)
  }

  // MARK: lower sage strip

  private var lowerStrip: some View {
    HStack(spacing: 10) {
      VStack(alignment: .leading, spacing: 2) {
        Text("Your order is on the way")
          .font(.system(size: 16, weight: .semibold, design: .serif))
          .foregroundColor(MandysColor.liveInk)
          .lineLimit(1)
          .minimumScaleFactor(0.8)

        if paused {
          HStack(spacing: 5) {
            Circle().fill(MandysColor.amber).frame(width: 5, height: 5)
            (Text("Location paused · last seen ")
              + Text(Date(timeIntervalSince1970: context.state.updatedAt), style: .relative)
              + Text(" ago"))
              .font(.system(size: 9.5, weight: .bold))
              .foregroundColor(Color(hex: 0x8A6E14))
              .lineLimit(1)
          }
          .padding(.horizontal, 9)
          .padding(.vertical, 2)
          .background(Capsule().fill(MandysColor.paper.opacity(0.9)))
          .padding(.top, 1)
        } else {
          subLine
            .font(.system(size: 10.5))
            .foregroundColor(MandysColor.liveInkSoft.opacity(0.8))
            .lineLimit(1)
        }
      }
      Spacer(minLength: 6)
      miniSteps
    }
    .padding(EdgeInsets(top: 6, leading: 14, bottom: 7, trailing: 14))
    .background(
      LinearGradient(
        colors: [MandysColor.liveSage1, MandysColor.liveSage2, MandysColor.sageDeep],
        startPoint: .topLeading, endPoint: .bottomTrailing
      )
    )
  }

  private var subLine: Text {
    let name = (context.state.driverName?.isEmpty == false) ? context.state.driverName! : "Your driver"
    if let away = MandysFormat.distanceAway(
      driverLat: context.state.driverLat, driverLng: context.state.driverLng,
      destLat: context.attributes.destLat, destLng: context.attributes.destLng
    ) {
      return Text(name).fontWeight(.bold) + Text(" is \(away)")
    }
    return Text(name).fontWeight(.bold) + Text(" has your order and is on the way")
  }

  private var miniSteps: some View {
    HStack(spacing: 6) {
      ForEach(0..<4) { i in
        if i < 2 {
          Circle().fill(MandysColor.liveDone).frame(width: 7, height: 7)
        } else if i == 2 {
          Circle()
            .fill(paused ? MandysColor.amber : MandysColor.paper)
            .frame(width: 8, height: 8)
            .background(
              Circle()
                .fill(paused ? MandysColor.amber.opacity(0.3) : MandysColor.paper.opacity(0.35))
                .frame(width: 14, height: 14)
            )
        } else {
          Circle().fill(MandysColor.liveInkSoft.opacity(0.25)).frame(width: 7, height: 7)
        }
      }
    }
  }
}

/// Two-segment quad-curve route: store→rider (traveled) and rider→dest
/// (remaining), with the mock's gentle lift on each control point.
@available(iOS 16.2, *)
struct RoutePath: Shape {
  let from: CGPoint
  let mid: CGPoint?
  let to: CGPoint
  let traveled: Bool

  func path(in rect: CGRect) -> Path {
    var p = Path()
    let pivot = mid ?? CGPoint(x: (from.x + to.x) / 2, y: (from.y + to.y) / 2)
    if traveled {
      guard mid != nil else { return p } // no rider → no traveled segment
      p.move(to: from)
      p.addQuadCurve(to: pivot, control: control(from, pivot))
    } else {
      p.move(to: pivot)
      p.addQuadCurve(to: to, control: control(pivot, to))
    }
    return p
  }

  private func control(_ a: CGPoint, _ b: CGPoint) -> CGPoint {
    // midpoint lifted slightly toward the top of the card for a soft arc
    CGPoint(x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - 10)
  }
}
