// 93-drink cartoon style catalog — generated from the macOS render harness
// (scratchpad/drink-harness/Catalog.swift), where every colour was sampled or
// tuned against the real product photos and reviewed side-by-side.
//
// Lookup is case/whitespace-insensitive on the Square catalog item name;
// unknown or missing names fall back to the classic brown milk-tea cup
// (identical to the original fixed BobaCupView).

import SwiftUI

@available(iOS 16.2, *)
private func C(_ h: UInt32) -> Color { Color(hex: h) }

@available(iOS 16.2, *)
enum DrinkCatalog {

  /// Style for a drink name coming through the Live Activity attributes.
  static func style(for name: String?) -> DrinkStyle {
    guard let name, let hit = index[normalize(name)] else { return fallback }
    return hit
  }

  /// Classic brown milk tea — the original BobaCupView palette.
  static let fallback = DrinkStyle(
    name: "Original Milk Tea",
    liquid: [C(0xF3DDBB), C(0xE5B87E), C(0xC98A4B), C(0xB5763B)],
    top: .milkFoam, boba: true, ice: false
  )

  private static func normalize(_ s: String) -> String {
    s.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
  }

  private static let index: [String: DrinkStyle] = {
    var m = [String: DrinkStyle]()
    for s in all { m[normalize(s.name)] = s }
    return m
  }()

  static let all: [DrinkStyle] = [

    // MILK TEA
    DrinkStyle(name: "Original Milk Tea", liquid: [C(0xF3DDBB), C(0xE5B87E), C(0xC98A4B), C(0xB5763B)], top: .milkFoam, boba: true, ice: false),
    DrinkStyle(name: "Brown Sugar Milk Tea", liquid: [C(0xE8C79E), C(0xC68B4E), C(0x8E5A2C)], top: .milkFoam, boba: true, ice: false),
    DrinkStyle(name: "Taro Milk Tea", liquid: [C(0xE6D9F2), C(0xCBB4E4), C(0xB49AD6)], top: .milkFoam, boba: true, ice: false),
    DrinkStyle(name: "Matcha Milk Tea", liquid: [C(0xD6E4AE), C(0xAEC97E), C(0x8BAE58)], top: .milkFoam, boba: true, ice: false),
    DrinkStyle(name: "Thai Milk Tea", liquid: [C(0xF3B96E), C(0xE58A3C), C(0xC96A24)], top: .milkFoam, boba: true, ice: false),
    DrinkStyle(name: "Chocolate Milk Tea", liquid: [C(0xD8B48C), C(0xA9754C), C(0x7B4A2A)], top: .milkFoam, boba: true, ice: false),
    DrinkStyle(name: "Coffee Milk Tea", liquid: [C(0xD5B48F), C(0xA87A50), C(0x6F4A2C)], top: .milkFoam, boba: true, ice: false),
    DrinkStyle(name: "Caramel Milk Tea", liquid: [C(0xEFD6AE), C(0xD6A566), C(0xB87B3C)], top: .milkFoam, boba: true, ice: false),
    DrinkStyle(name: "Brown Rice Milk Tea", liquid: [C(0xF0DFC0), C(0xD9BE93), C(0xC0A06E)], top: .milkFoam, boba: true, ice: false),
    DrinkStyle(name: "Coconut Milk Tea", liquid: [C(0xFBF3E4), C(0xEADFC8), C(0xD8C6A5)], top: .milkFoam, boba: true, ice: false),
    DrinkStyle(name: "Earl Grey Milk Tea", liquid: [C(0xE4D4BE), C(0xC4A886), C(0x9E7E58)], top: .milkFoam, boba: true, ice: false),
    DrinkStyle(name: "Honeydew Milk Tea", liquid: [C(0xE6F0C8), C(0xCBE0A0), C(0xAEC97E)], top: .milkFoam, boba: true, ice: false),
    DrinkStyle(name: "Jasmine Milk Tea", liquid: [C(0xF3E7C9), C(0xE0CBA0), C(0xC9AE7E)], top: .milkFoam, boba: true, ice: false),
    DrinkStyle(name: "Lychee Milk Tea", liquid: [C(0xFBEFEF), C(0xF0D9DE), C(0xE3C1C9)], top: .milkFoam, boba: true, ice: false),
    DrinkStyle(name: "Mango Milk Tea", liquid: [C(0xFCE6B0), C(0xF5C877), C(0xE8A64E)], top: .milkFoam, boba: true, ice: false),
    DrinkStyle(name: "Oolong Milk Tea", liquid: [C(0xE7D2AE), C(0xC7A06E), C(0xA17A48)], top: .milkFoam, boba: true, ice: false),
    DrinkStyle(name: "Peach Milk Tea", liquid: [C(0xFBE0C6), C(0xF3C094), C(0xE39E68)], top: .milkFoam, boba: true, ice: false),
    DrinkStyle(name: "Strawberry Milk Tea", liquid: [C(0xFBDCE4), C(0xF3B3C4), C(0xE88BA3)], top: .milkFoam, boba: true, ice: false),
    DrinkStyle(name: "Oreo Brulee Milk Tea", liquid: [C(0xE9DCC6), C(0xC9B393), C(0xA38E6E)], top: .milkFoam, boba: true, ice: false),

    // FRESH BREW
    DrinkStyle(name: "Jasmine Green Tea", liquid: [C(0xF3F1D8), C(0xE4E4B0), C(0xD2D48C)], top: .none, boba: false, ice: true),
    DrinkStyle(name: "Honey Green Tea", liquid: [C(0xECE3A8), C(0xD2CE78), C(0xB0B454)], top: .none, boba: false, ice: true),
    DrinkStyle(name: "Oolong Tea", liquid: [C(0xE6CFA0), C(0xC7A468), C(0xA07C44)], top: .none, boba: false, ice: true),
    DrinkStyle(name: "Ceylon Black Tea", liquid: [C(0xE0B888), C(0xC08A4E), C(0x96602F)], top: .none, boba: false, ice: true),
    DrinkStyle(name: "Earl Grey Tea", liquid: [C(0xDEC59A), C(0xBC9760), C(0x8E6A3C)], top: .none, boba: false, ice: true),
    DrinkStyle(name: "Honey Black Tea", liquid: [C(0xF0CE94), C(0xDDA85A), C(0xB57F38)], top: .none, boba: false, ice: true),
    DrinkStyle(name: "Brown Rice Tea", liquid: [C(0xEAD9B4), C(0xD3B784), C(0xB8965E)], top: .none, boba: false, ice: true),

    // FROZEN
    DrinkStyle(name: "Strawberry Slushy", liquid: [C(0xDD9D98), C(0xD4817B), C(0xCB706A)], top: .slushDome, boba: false, ice: false),
    DrinkStyle(name: "Mango Slushy", liquid: [C(0xEDCC81), C(0xE8BD5D), C(0xE1B24A)], top: .slushDome, boba: false, ice: false),
    DrinkStyle(name: "Blueberry Slushy", liquid: [C(0xB5A8B7), C(0xA08FA3), C(0x938095)], top: .slushDome, boba: false, ice: false),
    DrinkStyle(name: "Grape Slushy", liquid: [C(0xAC829E), C(0x945F82), C(0x854B72)], top: .slushDome, boba: false, ice: false),
    DrinkStyle(name: "Grapefruit Slushy", liquid: [C(0xE8ACA4), C(0xE1958A), C(0xD9867A)], top: .slushDome, boba: false, ice: false),
    DrinkStyle(name: "Green Apple Slushy", liquid: [C(0xB4D09E), C(0x9EC382), C(0x90B872)], top: .slushDome, boba: false, ice: false),
    DrinkStyle(name: "Guava Slushy", liquid: [C(0xE4AEAB), C(0xDD9694), C(0xD58885)], top: .slushDome, boba: false, ice: false),
    DrinkStyle(name: "Lemon Slushy", liquid: [C(0xE9DED0), C(0xE2D4C2), C(0xDACBB8)], top: .slushDome, boba: false, ice: false),
    DrinkStyle(name: "Lychee Slushy", liquid: [C(0xE9E0BD), C(0xE3D7AB), C(0xDBCE9E)], top: .slushDome, boba: false, ice: false),
    DrinkStyle(name: "Orange Slushy", liquid: [C(0xEDBE7F), C(0xE8AB5B), C(0xE19E47)], top: .slushDome, boba: false, ice: false),
    DrinkStyle(name: "Passion Fruit Slushy", liquid: [C(0xE9CA81), C(0xE3BB5C), C(0xDBAF49)], top: .slushDome, boba: false, ice: false),
    DrinkStyle(name: "Peach Slushy", liquid: [C(0xEAB09A), C(0xE59A7E), C(0xDD8B6D)], top: .slushDome, boba: false, ice: false),
    DrinkStyle(name: "Pineapple Slushy", liquid: [C(0xE7CB92), C(0xE0BC72), C(0xD8B161)], top: .slushDome, boba: false, ice: false),
    DrinkStyle(name: "Red Dragon Fruit Slushy", liquid: [C(0xC16A7C), C(0xAF4057), C(0xA32943)], top: .slushDome, boba: false, ice: false),
    DrinkStyle(name: "Watermelon Slushy", liquid: [C(0xE9A7A5), C(0xE38E8B), C(0xDB7F7C)], top: .slushDome, boba: false, ice: false),
    DrinkStyle(name: "Matcha Frappe", liquid: [C(0xB6C192), C(0xA2AF72), C(0x94A261)], top: .slushDome, boba: false, ice: false),
    DrinkStyle(name: "Chocolate Frappe", liquid: [C(0x97817D), C(0x795E58), C(0x684A44)], top: .slushDome, boba: false, ice: false),
    DrinkStyle(name: "Coffee Frappe", liquid: [C(0xAB9381), C(0x93745D), C(0x846249)], top: .slushDome, boba: false, ice: false),
    DrinkStyle(name: "Brown Sugar Milk Tea Frappe", liquid: [C(0xC8AE95), C(0xB89677), C(0xAC8866)], top: .slushDome, boba: false, ice: false),
    DrinkStyle(name: "Taro Frappe", liquid: [C(0xB6A8C0), C(0xA290AE), C(0x9481A2)], top: .slushDome, boba: false, ice: false),
    DrinkStyle(name: "Red Bean Frappe", liquid: [C(0x947D7C), C(0x765757), C(0x654343)], top: .slushDome, boba: false, ice: false),
    DrinkStyle(name: "Thai Coco Frappe", liquid: [C(0xE4AF87), C(0xDD9865), C(0xD48A52)], top: .slushDome, boba: false, ice: false),
    DrinkStyle(name: "Original Cookies & Cream", liquid: [C(0xB0A9A4), C(0x9A908B), C(0x8C817B)], top: .slushDome, boba: false, ice: false),
    DrinkStyle(name: "Caramel Cookies & Cream", liquid: [C(0xD1B99F), C(0xC4A584), C(0xBA9874)], top: .slushDome, boba: false, ice: false),
    DrinkStyle(name: "Mint Cookies & Cream", liquid: [C(0xBBD0C1), C(0xA8C3B0), C(0x9BB8A4)], top: .slushDome, boba: false, ice: false),

    // FRUITY BLACK TEA
    DrinkStyle(name: "Peach Black Tea", liquid: [C(0xDDA77D), C(0xD38E57), C(0xCA7F43)], top: .none, boba: false, ice: true),
    DrinkStyle(name: "Lemon Black Tea", liquid: [C(0xDFA878), C(0xD68F51), C(0xCD7F3D)], top: .none, boba: false, ice: true),
    DrinkStyle(name: "Mango Black Tea", liquid: [C(0xA5776E), C(0x8B5044), C(0x7C3B2E)], top: .none, boba: false, ice: true),
    DrinkStyle(name: "Passion Fruit Black Tea", liquid: [C(0xDBA97A), C(0xD09153), C(0xC7823F)], top: .none, boba: false, ice: true),
    DrinkStyle(name: "Pineapple Black Tea", liquid: [C(0xE4BE74), C(0xDDAB4C), C(0xD59F37)], top: .none, boba: false, ice: true),
    DrinkStyle(name: "Strawberry Black Tea", liquid: [C(0xB9656C), C(0xA53942), C(0x98232C)], top: .none, boba: false, ice: true),
    DrinkStyle(name: "Grape Black Tea", liquid: [C(0x8F6966), C(0x6F3E3B), C(0x5D2724)], top: .none, boba: false, ice: true),
    DrinkStyle(name: "Grapefruit Black Tea", liquid: [C(0xDA9E8D), C(0xCF826C), C(0xC6725A)], top: .none, boba: false, ice: true),
    DrinkStyle(name: "Guava Black Tea", liquid: [C(0xD198A6), C(0xC37A8C), C(0xB9697D)], top: .none, boba: false, ice: true),
    DrinkStyle(name: "Blueberry Black Tea", liquid: [C(0x95726A), C(0x774A40), C(0x66352A)], top: .none, boba: false, ice: true),
    DrinkStyle(name: "Lychee Black Tea", liquid: [C(0xCD9889), C(0xBF7B68), C(0xB46A55)], top: .none, boba: false, ice: true),

    // FRUITY GREEN TEA
    DrinkStyle(name: "Strawberry Iced Tea", liquid: [C(0xE49183), C(0xDC715F), C(0xD4604C)], top: .none, boba: false, ice: true),
    DrinkStyle(name: "Mango Iced Tea", liquid: [C(0xEFC16E), C(0xEBAF45), C(0xE4A32F)], top: .none, boba: false, ice: true),
    DrinkStyle(name: "Peach Iced Tea", liquid: [C(0xEAB066), C(0xE49A3A), C(0xDC8C24)], top: .none, boba: false, ice: true),
    DrinkStyle(name: "Passion Fruit Iced Tea", liquid: [C(0xE2B473), C(0xDA9F4B), C(0xD29136)], top: .none, boba: false, ice: true),
    DrinkStyle(name: "Lemon Iced Tea", liquid: [C(0xDCAB7B), C(0xD29255), C(0xC98441)], top: .none, boba: false, ice: true),
    DrinkStyle(name: "Green Apple Green Tea", liquid: [C(0xAFBB65), C(0x98A73A), C(0x899A23)], top: .none, boba: false, ice: true),
    DrinkStyle(name: "Pineapple Green Tea", liquid: [C(0xE9C966), C(0xE2BA3A), C(0xDBAF24)], top: .none, boba: false, ice: true),
    DrinkStyle(name: "Orange Iced Tea", liquid: [C(0xECA163), C(0xE78636), C(0xE0761F)], top: .none, boba: false, ice: true),
    DrinkStyle(name: "Grape Iced Tea", liquid: [C(0xBB87AB), C(0xA76493), C(0x9A5285)], top: .none, boba: false, ice: true),
    DrinkStyle(name: "Grapefruit Iced Tea", liquid: [C(0xEAB782), C(0xE4A25E), C(0xDC954A)], top: .none, boba: false, ice: true),
    DrinkStyle(name: "Guava Iced Tea", liquid: [C(0xEEB59B), C(0xEA9F7E), C(0xE3926D)], top: .none, boba: false, ice: true),
    DrinkStyle(name: "Blueberry Iced Tea", liquid: [C(0x88849B), C(0x66607E), C(0x534D6E)], top: .none, boba: false, ice: true),
    DrinkStyle(name: "Lychee Iced Tea", liquid: [C(0xECDCA7), C(0xE7D28E), C(0xDFC97F)], top: .none, boba: false, ice: true),
    DrinkStyle(name: "Four Seasons Fruit Tea", liquid: [C(0xE0AE8C), C(0xD7976B), C(0xCE8959)], top: .none, boba: false, ice: true),
    DrinkStyle(name: "Yakult Green Tea", liquid: [C(0xEADDD1), C(0xE4D3C4), C(0xDCCABA)], top: .none, boba: false, ice: true),

    // CHEESE CREAM
    DrinkStyle(name: "Strawberry Cheese", liquid: [C(0xF7C0CC), C(0xEE95AB), C(0xE57892)], top: .cheeseCap, boba: false, ice: false),
    DrinkStyle(name: "Mango Cheese", liquid: [C(0xFBDD97), C(0xF3B85C), C(0xE89638)], top: .cheeseCap, boba: false, ice: false),
    DrinkStyle(name: "Blueberry Cheese", liquid: [C(0xC0C8E4), C(0x9AA4D0), C(0x7E88BC)], top: .cheeseCap, boba: false, ice: false),
    DrinkStyle(name: "Red Dragon Fruit Cheese", liquid: [C(0xE89BC4), C(0xD96BA0), C(0xC6467E)], top: .cheeseCap, boba: false, ice: false),
    DrinkStyle(name: "Watermelon Cheese", liquid: [C(0xF6A6A6), C(0xEC7676), C(0xDE5555)], top: .cheeseCap, boba: false, ice: false),

    // SPECIAL MIX
    DrinkStyle(name: "Strawberry Milkshake", liquid: [C(0xF9C7D2), C(0xF2A0B4), C(0xE87E99)], top: .none, boba: false, ice: false),
    DrinkStyle(name: "Mango Milkshake", liquid: [C(0xFBDD97), C(0xF3B85C), C(0xE89638)], top: .none, boba: false, ice: false),
    DrinkStyle(name: "Banana Milkshake", liquid: [C(0xFBF0C4), C(0xF3E08C), C(0xE8C85C)], top: .none, boba: false, ice: false),
    DrinkStyle(name: "Papaya Milkshake", liquid: [C(0xFBD0A8), C(0xF3AA7C), C(0xE88656)], top: .none, boba: false, ice: false),
    DrinkStyle(name: "Brown Sugar Fresh Milk", liquid: [C(0xF3E9DA), C(0xE0C8A8), C(0xC69A6E)], top: .milkFoam, boba: true, ice: false),
    DrinkStyle(name: "Wintermelon Fresh Milk", liquid: [C(0xEEE0CC), C(0xD8C0A0), C(0xBE9E74)], top: .milkFoam, boba: false, ice: false),
    DrinkStyle(name: "Honey Citron Tea", liquid: [C(0xF5D890), C(0xE8B45C), C(0xD08E38)], top: .none, boba: false, ice: true),
    DrinkStyle(name: "Honey Ginger Tea", liquid: [C(0xF0CE94), C(0xDDA85A), C(0xB57F38)], top: .none, boba: false, ice: true),
    DrinkStyle(name: "Guava Lemon Tea", liquid: [C(0xF2C4B8), C(0xE29A8C), C(0xD07868)], top: .none, boba: false, ice: true),
    DrinkStyle(name: "Wintermelon Lemon Tea", liquid: [C(0xE8DCB0), C(0xD0BE80), C(0xB49E5C)], top: .none, boba: false, ice: true),
    DrinkStyle(name: "Wintermelon Tea", liquid: [C(0xE0C8A0), C(0xC4A26E), C(0xA07E48)], top: .none, boba: false, ice: true),
  ]
}
