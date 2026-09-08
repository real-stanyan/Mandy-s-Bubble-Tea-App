// Which scene components/brand/OrderHero draws for an order, from the signals
// the order screen already has.
//
// Mirror of the web's orderScene() in src/lib/order-status-ui.ts, with one
// deliberate difference noted on `scheduledAhead` below. Kept pure and away
// from the screen so it can be read on its own and tested.

export type OrderScene = 'received' | 'preparing' | 'ready' | 'done' | 'packed' | 'delivered'

export type SceneInput = {
  /** The screen's resolved display state (see resolveDisplayState). */
  state: 'COMPLETED' | 'READY' | 'OPEN' | 'CANCELED' | string
  isDelivery: boolean
  /** deriveDeliverySteps().stepIndex — 0 placed, 1 accepted, 2 picked up, 3 delivered. */
  dispatchStep?: number
  /**
   * A scheduled pickup whose time has not come yet.
   *
   * The web reads its `held` flag off the print queue: nobody is making the
   * drinks until the cup sticker prints, so "Preparing" would be a lie. The
   * app has no window onto that queue, so it asks the nearest question it can
   * answer — is the chosen pickup time still ahead of us. The two agree except
   * in the minutes between the sticker printing and the pickup time, where the
   * app will say Received for a little longer than the web does. Better late
   * than the other way: claiming to be making a drink nobody has started is
   * the failure that put this scene here.
   */
  scheduledAhead?: boolean
}

/**
 * The scene, or null when a drawing would be wrong rather than merely absent.
 *
 * Delivery walks its own three:
 *
 *  • Placed / finding a driver, and a driver on the way to collect: the shop
 *    is making the drinks, exactly as for a pickup order, so it is the same
 *    Preparing scene. Whether a driver has been matched yet is the stepper's
 *    job to say; it does not change what is happening to the tea.
 *  • Out for delivery: null, and deliberately. The screen at that step is a
 *    full-bleed live map with the driver moving on it — a drawing of a
 *    doorstep next to the real thing would be the app illustrating what it is
 *    already showing.
 *  • Delivered: the doorstep, cups going into the insulated bag. At checkout
 *    that picture is a promise; here it is what just happened.
 *
 * And null for a cancelled order in either mode — a counter full of drinks
 * under "Order Cancelled" reads as the app not having noticed.
 */
export function orderScene({
  state,
  isDelivery,
  dispatchStep = 0,
  scheduledAhead = false,
}: SceneInput): OrderScene | null {
  if (state === 'CANCELED') return null
  if (isDelivery) {
    if (state === 'COMPLETED' || dispatchStep >= 3) return 'delivered'
    return dispatchStep <= 1 ? 'preparing' : null
  }
  if (state === 'COMPLETED') return 'done'
  if (state === 'READY') return 'ready'
  return scheduledAhead ? 'received' : 'preparing'
}
