# ADR-0001: Publishing is automatic on merge, and fails closed on anything native

Date: 2026-08-09
Status: Accepted
Issue: #46

## Context

Merging to `main` in this repo reached nobody. The web repo auto-deploys on push
via Vercel; here, shipping meant someone remembering to run `eas update` (JS-only
changes) or cutting a store build (native changes). `.claude/deployment.md` did
not say so.

That gap has now bitten repeatedly:

- PR #43 sat unpublished.
- PR #44 merged 2026-08-03 and sat unpublished — this became #45.
- PR #53 merged 2026-08-09 and sat unpublished until someone happened to look.

Each time, the code was correct, the gate was green, and no customer saw it. A
release step that depends on memory is not a release step.

## Decision

**Publish on merge to `main`, automatically, and refuse to publish anything that
might need native code.**

A `publish` workflow runs on push to `main`. It classifies the merge:

- **JS-only** → run the gate, then
  `eas update --branch production --platform ios --environment production`.
- **Possibly native** → publish nothing, and fail the job with an explicit
  message naming the paths that triggered it.

"Possibly native" is a path list, not an analysis: `ios/`, `android/`,
`package.json`, `package-lock.json`, `app.json`, `eas.json`, `patches/`, and
`scripts/patch-*.js`. Any hit means a human decides.

### Why fail closed rather than skip quietly

A silent skip reproduces the exact bug this ADR exists to close: a merge that
reaches nobody and says nothing. A red job in the Actions tab is a visible loose
end. The cost is that a native merge always ends in a red check that someone must
acknowledge — that is the intended signal, not a defect.

### Why the path list is deliberately over-broad

Classifying "does this JS change require new native code" correctly is not
possible from a diff. Over-broad means some JS-only merges get held for a human;
under-broad means an OTA lands on a binary that cannot run it, and the failure
appears on customers' phones rather than in CI. The asymmetry is not close.

`app.json` is on the list for a specific reason beyond native config:
`runtimeVersion` lives there (currently `24`). Changing it and then OTA-ing is
how you publish an update no installed app is eligible for.

## Consequences

- `EXPO_TOKEN` must exist as a repo secret. Until it does, the workflow fails on
  every push to `main` with a clear message. That is intentional: a broken
  publish path should be loud, and this is a credential only the maintainer can
  supply.
- `--platform ios` is pinned. The `production` branch is iOS-only, and the
  default `--platform all` crashes at bundle time on the web export
  (`ReferenceError: window is not defined`, `@supabase/auth-js` →
  `@react-native-async-storage` during SSR). An automated job that omits the flag
  fails every run — see #46.
- `--environment production` is pinned so the bundle takes its `EXPO_PUBLIC_*`
  values from the EAS `production` environment rather than from whatever the
  runner happens to have. The local-`.env.local`-leaks-sandbox-credentials
  failure is #41.
- Store builds stay manual. They need interactive credential setup for the Live
  Activity target (#49), so they are out of scope here.

## Alternatives considered

**Document it and add it to the shift-end checklist** (option 2 in #46). Rejected:
the checklist already exists and the gap still happened three times. A process
that has failed repeatedly under the same conditions is not fixed by writing it
down more clearly.

**Publish from the merge author's machine.** Rejected: that is the status quo, and
it makes an OTA's correctness depend on whose laptop ran it — which is how #41
shipped sandbox credentials to production.
