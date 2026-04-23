# App Store Connect — Submission Copy

Draft for initial submission (v1.0.5). Keep this in sync whenever App Store
Connect metadata changes so future resubmissions start from the last
approved copy, not a blank page.

Last updated: 2026-04-23

---

## Subtitle (30 chars max)

```
Order ahead. Earn free drinks.
```
(30 chars exactly.)

---

## Keywords (100 chars max, comma-separated, **no spaces after commas**)

```
bubble tea,boba,milk tea,southport,gold coast,order,takeaway,rewards,loyalty,drinks,mandys
```

(90 chars, 10 spare.) Don't repeat words that already appear in App Name
or Subtitle — Apple indexes those automatically.

---

## Promotional Text (170 chars — editable without review)

```
Skip the queue and earn a free drink after every 9 purchases. Order ahead from Southport's favourite bubble tea shop — straight from your phone.
```

Use this field for time-limited promos later (new drinks, seasonal
discounts) — changes to Promotional Text don't trigger re-review.

---

## Description (4000 chars max)

```
Mandy's Bubble Tea — the freshest, friendliest bubble tea in Southport, now in your pocket.

Order ahead, skip the queue, and earn a free drink for every 9 you buy. From silky milk teas to fresh-brewed classics, handcrafted fruity blends to cheese cream tops — browse the full menu, customise your cup, and pay securely with Apple Pay, Google Pay, or card.

WHY ORDER IN THE APP
• Beat the queue — order ahead and pick up when it's ready
• Earn stars automatically — every drink counts toward a free one
• 30% off your very first order as a new member
• Faster checkout with Apple Pay & Google Pay
• Save your favourites and reorder in two taps
• Get a notification the moment your order is ready

LOYALTY THAT ACTUALLY REWARDS YOU
Buy 9 drinks. Get 1 free. That's it.
Every purchase earns a star — whether it's a Milky, Fruity, Fresh Brew, Special Mix, Fruity Black, Frozen, or Cheese Cream. Redeem any drink up to the value of your purchased ones. No tiers, no expiry tricks, no fine print.

OUR FULL MENU, YOUR WAY
Seven categories. Dozens of drinks. Fully customisable:
• Milky Tea — classic milk teas with your choice of tea base
• Fruity Tea — refreshing fruit-forward blends
• Fresh Brew — pure, single-origin leaf brews
• Special Mix — our signature house creations
• Fruity Black Tea — bold black tea with real fruit
• Frozen — blended drinks for hot Queensland days
• Cheese Cream — rich, salted cheese foam on top

Choose your sweetness, ice level, and toppings — tapioca pearls, jelly, pudding, aloe, and more.

MEMBER PERKS
• Digital loyalty card — always with you
• Add your member pass to Apple Wallet
• Order history, spend tracking, and activity log
• Secure, phone-based sign-in — no passwords to remember

PICKUP AT
34 Davenport St, Southport QLD 4215
Phone: 0404 978 238

Open 7 days. Check in-app for today's hours.

ABOUT MANDY'S
We're a small bubble tea shop on the Gold Coast with one mission: serve great tea, quickly, and remember everyone's name. The app is part of that — less waiting, better rewards, the same drinks we'd make you if you walked in.

Questions? Suggestions? A drink you'd love us to try? We read every message. Tap the store info in the app or call us directly — we'd love to hear from you.
```

(~2400 chars, ~1600 chars headroom for future feature adds.)

---

## What's New — Version 1.0.5 Release Notes

```
• Redesigned loyalty card with bigger stars and clearer progress
• Cleaner Account page with tidier order history
• Delete your account directly from the app
• Smoother Home carousel and sign-in experience
• Orders now close 5 minutes before the shop does — no more arriving to a locked door
```

---

## App Review Information / Notes

**This is the single most important field for passing review on first try.**
It gives the reviewer the demo credentials, the payment-exemption argument,
and the test flow — all three have to be present or reviewers get stuck
and reject.

```
DEMO CREDENTIALS
Phone number: +61 400 000 000
One-time code: 123456

This phone number is pre-registered in our Supabase Auth dashboard as a test
number that always returns the fixed code above without dispatching an SMS,
so the reviewer can sign in instantly without needing access to an
Australian mobile number.

ABOUT PAYMENTS — GUIDELINE 3.1.3(e) (physical goods)
Mandy's Bubble Tea is a physical bubble tea shop located at 34 Davenport St,
Southport QLD 4215, Australia. The app sells only physical goods (drinks)
prepared in-store and collected in person by the customer. All payments are
processed through Square's Web Payments SDK (Apple Pay, Google Pay, and
card) in accordance with Guideline 3.1.3(e), which exempts the purchase of
physical goods and services from the requirement to use Apple's In-App
Purchase system.

TEST FLOW
1. Tap "Sign in" → enter +61 400 000 000 → code 123456 → enter any first
   name if prompted.
2. Browse the menu, add a drink to cart, proceed to checkout.
3. Tap through to the checkout screen to verify the Apple Pay sheet,
   payment method picker, and order total render correctly. **Please
   stop here without submitting payment** — review test orders cannot
   be fulfilled because we are a single physical pickup location.
4. Account features (loyalty stars, member QR, order history, "Add to
   Apple Wallet") are all reachable without completing a paid order
   and can be exercised independently from the Account tab.
5. To test account deletion: Account tab → scroll to bottom → tap
   "Delete Account" → confirm "Delete forever". The account is purged
   from our backend and from Square within seconds.

SCOPE
We operate only in Queensland, Australia. All prices are in AUD and
include GST. The app does not use third-party advertising, analytics, or
tracking SDKs.

CONTACT FOR REVIEW QUESTIONS
Email: stanhavenoidea@gmail.com
Phone: 0404 978 238
```

---

## Other App Store Connect fields — quick reference

| Field | Value |
|---|---|
| Category (primary) | Food & Drink |
| Category (secondary) | Shopping |
| Age Rating | 4+ (no objectionable content) |
| Privacy Policy URL | https://mandybubbletea.com/privacy |
| Support URL | https://mandybubbletea.com/ |
| Marketing URL | https://mandybubbletea.com/ (optional, fine to leave blank) |
| Pricing | Free |
| Availability | Australia only (App Store territory = AU) |
| Export Compliance | Standard encryption (HTTPS only) — exempt, no ERN needed |
| Account type | **Individual** (Stan Yan) for v1 launch — Organization upgrade is a separate 2–4 week DUNS+Apple verification process; switch later as a rebrand task once shop is live and earning |

---

## App Privacy "Data Collection" questionnaire

This is the most error-prone screen in App Store Connect — Apple compares
your answers against actual SDK behavior and rejects mismatches. The
answers below match what the codebase actually does as of 2026-04-23.

**Tracking status (top question):** No, we do not use data for tracking
purposes. (No third-party advertising, no analytics SDKs, no data brokers.)

**Data Types Collected** — declare each of the following as collected,
linked to identity, NOT used for tracking, purpose = App Functionality:

| Category | Data Type | Why |
|---|---|---|
| Contact Info | Name | Customer name on orders + greeting in app |
| Contact Info | Phone Number | Supabase phone OTP sign-in + order pickup contact |
| Contact Info | Email Address | Optional via Sign in with Apple/Google relay; not required |
| Financial Info | Payment Info | Processed by Square; we never see or store the PAN |
| Identifiers | User ID | Supabase `user_id` + Square `customer_id` |
| Identifiers | Device ID | Expo push token (APNs/FCM) for order-ready notifications |
| Purchases | Purchase History | Order list + loyalty progress tracking |

**Data Types NOT Collected** (answer "No, we do not collect..." for):
- Health & Fitness
- Location (precise OR coarse — we never request location permission)
- Sensitive Info
- Contacts (we never request the iOS contacts permission)
- User Content (Photos, Audio, Gameplay, Customer Support content stored)
- Browsing History
- Search History (we do not log in-app search queries to a server)
- Usage Data — Advertising Data
- Usage Data — Other Usage Data
- Diagnostics (we ship no third-party crash/perf SDK; native Apple
  crash reports go to Apple, not to us, so they are not declared here)
- Other Data

**Per-data-type follow-up questions** — for each declared item above:
- Is the data linked to the user's identity? **Yes**
- Is the data used for tracking purposes? **No**
- Purposes: ☑ App Functionality only. (Leave Analytics, Developer
  Advertising, Third-Party Advertising, Product Personalization, Other
  Purposes all **unchecked**.)

---

## Screenshots — 6.9" (1290 × 2796) required

Apple requires at least one screenshot for the 6.9" class (iPhone 16 Pro Max).
One set of 6.9" screenshots scales down automatically to other sizes.

Recommended 5-frame story:

1. **Home + Hero carousel** — brand + loyalty card visible ("Order ahead. Earn free drinks." angle)
2. **Menu category grid** — shows the 7 categories at once, communicates breadth
3. **Item detail with customisation** — sweetness / ice / toppings, shows "your way"
4. **Cart / checkout** — Apple Pay button visible, proves frictionless pay
5. **Account + loyalty card** — stars + progress, proves the reward story

Optional 6th:
- **Order confirmation + push preview** — "Your order is ready 🧋" — proves pickup UX

Capture on iPhone 16 Pro Max (or simulator @ 1290×2796) with status bar
cleaned (simctl status_bar override).

---

## Submission checklist

- [ ] Subtitle, Keywords, Description, Promotional Text pasted in App Store Connect
- [ ] Version 1.0.5 created; "What's New" filled
- [ ] App Review Information — demo creds + 3.1.3(e) statement + test flow filled
- [ ] Privacy Policy URL set to mandybubbletea.com/privacy
- [ ] Support URL set
- [ ] Age Rating questionnaire filled (all "No")
- [ ] App Privacy questionnaire — declare: name, phone, push token; no tracking
- [ ] Export Compliance answered (standard encryption exempt)
- [ ] Pricing = Free, Availability = Australia
- [ ] Screenshots 6.9" ×5 uploaded
- [ ] App Icon 1024×1024 (no alpha, no rounded corners — Apple masks it)
- [ ] Build 1.0.5 archived + uploaded + selected for review
- [ ] Submit for Review
