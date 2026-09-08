import { Component, type ErrorInfo, type ReactNode } from 'react'

/**
 * A drawing is never worth a screen.
 *
 * #163: the order hero threw somewhere inside react-native-svg / Reanimated
 * and took the whole Order Detail screen down with it — tapping Track Order
 * crashed the app for every customer until the OTA was rolled back. The
 * picture is decoration; the screen underneath is a customer's order, their
 * pickup number and their receipt.
 *
 * So the picture gets a boundary. If it throws, this renders nothing and the
 * order screen carries on without it. That is a visibly worse screen and a
 * completely working one, which is the right trade every time.
 *
 * Deliberately NOT a general-purpose boundary: wrap decorative subtrees only.
 * Swallowing an error around something a customer needs would hide a real
 * failure behind a blank space.
 */
export class SceneBoundary extends Component<
  { children: ReactNode; name: string },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Left in on purpose: without it a boundary turns a loud crash into a
    // silent missing picture, and nobody finds out until someone notices the
    // blank. Shows up in the device log and in EAS/Sentry breadcrumbs.
    console.error(`[scene:${this.props.name}] failed to render`, error, info.componentStack)
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}
