import * as Haptics from 'expo-haptics'

// The haptic vocabulary: one named feel per kind of moment, so the menu, the
// item sheet and the bag all speak the same language under the finger. Every
// call swallows its promise — a device without a haptic engine (the
// simulator, some Androids) must never turn a tap into an unhandled rejection.
//
//   tap      a surface acknowledges the finger (card press-in)
//   tick     the rail follows the scroll into a new category — a detent
//   pick     the customer chose something (a category pill)
//   add      something went into the bag (the + on a card)
//   dock     the header settles into its compact bar, or lets go of it
//   warn     that is not possible right now (sold out)
//   success  the order/bag landed
const swallow = () => {}

export const haptic = {
  tap: () => Haptics.selectionAsync().catch(swallow),
  tick: () => Haptics.selectionAsync().catch(swallow),
  pick: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(swallow),
  add: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(swallow),
  dock: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(swallow),
  warn: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(swallow),
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(swallow),
} as const

export type HapticName = keyof typeof haptic
