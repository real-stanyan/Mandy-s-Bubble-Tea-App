# Domain context — mandys_bubble_tea_app

Domain glossary. All agents' understanding of domain terms is grounded here; code naming stays consistent with the terms defined here.

## Terms

| Term | Definition | Notes |
|---|---|---|
| single source of truth | Rules are written in exactly one place (`AGENTS.md`); other agent configs (e.g. `CLAUDE.md`) only `@`-reference it, never copy it | Prevents rules from drifting across multiple locations |
| empty-shell contract | `CLAUDE.md`'s content is exactly one line, `@AGENTS.md` — a physical guarantee that Claude Code and Z Code read the same rules | The structural self-check script asserts this |
| handoff | One agent passes a task to another agent — **this only happens the moment an issue closes / a PR merges**, never mid-task | It isn't a handoff just because things were "explained clearly" — it's a handoff only when the issue closes |
| protocol gap | A question the repo's persistent artifacts (AGENTS.md / ADR / CONTEXT.md) can't answer | Hitting one requires opening an issue — silent judgment calls are not allowed |
| The three issue roles | The three non-overlapping uses of issues/PRs in this protocol: **Task** / **Memory** (handoff memory) / **Protocol gap** | Every issue should fall into exactly one of these — see AGENTS.md |
| gate | The command that must be all-green before ending a shift. See the Gate section in AGENTS.md for this repo's command | CI runs the same command — red means no merge |
| L1/L2 tiers | Two authorization tiers for protocol changes: **L1 strict tier** (Hard rules / Gate / Tech stack / the "Changing the protocol itself" section itself) requires explicit maintainer agreement before merging; **L2 autonomous tier** (the rest of Working agreement / indexes) the agent can merge on its own | ADR-0006; boundary criteria in ADR-0012 |
| Mechanism reference (criterion) | Any new content that references L1/L2, Hard rules, Working agreement, or other protocol mechanisms (by keyword or semantic dependency) is treated as L1 | ADR-0012, "mechanism reference takes priority"; guards against using "optional + pure addition" as an L2 loophole to expand the protocol |
| Memory five-part format | The minimum valid format for a handoff comment: ① what's done ② what's blocked ③ what's next ④ close the issue if the task is complete ⑤ rationale/trade-offs (write "none" if no decision was made) | ADR-0004; missing any item makes the handoff invalid |
| terminal shift | The form a shift ends in when archiving / confirming there's no next shift: a handoff issue may be skipped, but the last closed issue must explicitly declare "no next shift" + a reason. Repo-level, not lane-level — invalid while another lane is still live | ADR-0009; a silent ending doesn't count as terminal; repo-level scope per ADR-0048 |
| blocking edge | A literal `Blocked by: #N` line in a dependent Task issue's body, declaring one prerequisite Task per line | ADR-0044; a hygiene convention — a stale edge costs a judgment call, not a violation |
| frontier task | An open Task issue with no open blockers — the only kind of task a shift may claim; when a blocker closes, its dependents join the frontier | ADR-0044 |
| claim | Self-assignment on a Task issue (`gh issue edit <N> --add-assignee @me`), first wins; a "claiming this" comment where assignment isn't possible. An open frontier task with no assignee and no claim comment is free | ADR-0047; single-human repos may skip — the value begins at the second human |
| lane | One shift plus the tasks it has claimed; parallel shifts are allowed iff lanes are disjoint (each works only on frontier tasks it claimed) | ADR-0048; handoff issues are per-lane |
| context-only handoff | A handoff issue whose lane finished with nothing to transfer — kept for its Memory comment, closed by its first reader after reading | ADR-0048 |
| downstream | A project that copies this Gearbox protocol and then evolves independently; sync status is self-checked downstream via `gearbox-version` (pull-primary, ADR-0026 — the upstream fleet dashboard was retired in ADR-0033) | See ADR-0026 |
| backfill | Downstream pulls Gearbox protocol improvements into its local copy; **pull-triggered** — downstream runs `gearbox-version` at the start of a shift to self-check, and `gearbox-update` if it's behind, with no dependency on upstream pushing; it's alignment, not enforcement — downstream can decline | ADR-0013 → ADR-0026 (push-triggered was downgraded to pull-triggered) |
| protocol version number | A semver-variant tag: **major** = cross-tool/cross-repo contract change; **minor** = a new mechanism added; **patch** = revision of an existing file. Every protocol PR declares a `Version bump`; the author tags after merge; the downstream local version is recorded in the `.gearbox-version` stamp (written and read by tooling) | ADR-0023; baseline v0.0.0 |

## Project domain (Mandy's Bubble Tea)

| Term | Definition | Notes |
|---|---|---|
| star | Loyalty unit: 1 drink = 1 star, across all 7 categories; 9 stars = Free Drink of Your Choice | Rules configured in Square Dashboard — no code changes needed |
| drink categories | MILKY / FRUITY / SPECIAL MIX / FRESH BREW / FRUITY BLACK TEA / FROZEN / CHEESE CREAM | All 7 earn stars |
| brand | Primary `#C43A10` (brick red), accent `#F5E6C8` (cream); system font; friendly casual bubble-tea-shop tone | See `lib/constants.ts` |
| business | Mandy's Bubble Tea, 34 Davenport St, Southport QLD 4215; ph 0404 978 238; mandybubbletea.com | Timezone Australia/Brisbane; currency AUD |
| OTA update | JS-only changes ship via expo-updates; native changes require a full EAS build (`ios/` is hand-curated) | See `.claude/deployment.md` |

## Key invariants

- `AGENTS.md` is always the single source of rules; `CLAUDE.md` is always just the `@AGENTS.md` empty shell
- No `HANDOFF.md` is created — handoffs happen via issue comments (append-only, timestamped)
- The gate command must be byte-identical in AGENTS.md and ci.yml (CI == Gate contract)
- One agent completes a task from start to finish; handoffs only happen at task boundaries

## Motion vocabulary (App UI v2, 2026-09-06)

Ten named motions, each implemented once and reused; all respect Reduce Motion (checked by `lib/motion/motion-invariants.test.ts`). Pure timing/geometry lives in `lib/motion/`; components in `components/ui`, `components/brand`, `components/cart`.

| Term | Definition | Where |
|---|---|---|
| Pour-in | Screen-block entrance: rises + fades in, 700ms expo-out, siblings staggered 70ms | `components/ui/Reveal.tsx` |
| Settle | Press feel: quick spring to ~0.965 on press-in, looser spring back (slight overshoot) on release | `components/ui/PressScale.tsx` |
| Drop | A piece falls into place from above with a small spring settle (toppings, ice, pearls) | `CupPreview` Drop, `LiquidCup` Pearl |
| Wave | Liquid pours in (Rise) and its surface ribbon scrolls one wavelength per loop, seamlessly | `lib/motion/wave.ts`, `LiquidCup`, `CupPreview` Surface |
| Count-up | A number ticks from its last value to the new one over 900ms ease-out; integers only | `components/ui/CountUp.tsx` |
| Pulse | A ring leaves a live-state dot every 1.7s and fades as it grows (open, kitchen, current order step) | `components/ui/PulseDot.tsx` |
| Slide | One highlight travels between options (400ms expo-out) instead of each option repainting | `OrdersFilterPills`, menu rail `SlidingRail` |
| Fly-to-bag | Add to cart launches a dot that arcs from the button to the mini cart bag; the bar bumps on landing | `store/flyToBag.ts`, `components/cart/FlyToBagLayer.tsx` |
| Launch | Cold-start screen: native splash colour lifts to the page ground, a cup pours, pearls drop, wordmark rises; never shorter than the pour, never longer than 10s | `components/launch/LaunchScreen.tsx`, `lib/motion/launch-timeline.ts` |
| Grain | 5% (evening 9%) tiled noise over the whole app, paper rather than plastic | `components/ui/GrainOverlay.tsx`, `scripts/gen-grain.mjs` |
| Category art | The eight category illustrations, drawn (the Mini Cup, ink lines, cup-visual colours, no people) and alive: one signature loop each — pearls rise, citrus spins, a slice floats, steam curls, frost twinkles, the cheese-tea cup tilts to sip, two colours swirl, a crown hops. Phase→frame maths in lib; frames become native `matrix`/`opacity`. Menu banners and the Home grid; the webp banners are gone | `components/brand/CategoryArt.tsx`, `lib/motion/category-art.ts`, `lib/menu/category-art.ts` |

Home is the counter (direction A, 2026-09-06): live pill (open · kitchen mood · wait), the order being made, an order-again rail, the rewards strip, this week's specials, one offers carousel (every promo card in one section), the illustrated category grid, the store. `components/home/*`.

Rule for any rn-svg group animation: drive the NATIVE props (`matrix`, `opacity`) from `useAnimatedProps`, and hold the group at opacity 0 until its first animation frame. A `<G>` takes its native matrix from its own props on first render, so an animated matrix only lands with the first frame (#122, and the launch cup on 2026-09-06).

