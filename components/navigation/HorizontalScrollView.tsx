import { createContext, forwardRef, useContext, useEffect, useMemo } from 'react'
import { ScrollView, type ScrollViewProps } from 'react-native'
import { Gesture, GestureDetector, type NativeGesture } from 'react-native-gesture-handler'

// A horizontal scroller the tab pager yields to. On iOS the pager's pan and
// a horizontal UIScrollView under it race for the touch — whichever passes
// its slop first wins, and with the pager at ten points that was the pager
// as often as not: the category rail on the menu would not scroll, the page
// turned instead (Rick's phone, 2026-09-11). So every horizontal scroller
// inside the tabs is one of these: a native gesture wrapped around the
// scroll view, registered with the pager, which then requires it to fail
// before its own pan may begin. A touch that starts on the rail belongs to
// the rail; the pager only gets it if the rail lets it go (a vertical
// drag). A touch anywhere else never meets the rail's gesture, so nothing
// changes for it. Android already settled this its own way (the scroll view
// asks its parents not to intercept, and the pan is cancelled); the
// registration is harmless there.
//
// Outside the pager (a horizontal row on the checkout page) there is no
// registry, and this is a plain ScrollView with a gesture nobody waits for.

export type ScrollRegistry = {
  /** Register a scroller's gesture; returns the way to take it back. */
  register: (gesture: NativeGesture) => () => void
}

export const SwipeScrollContext = createContext<ScrollRegistry | null>(null)

export const HorizontalScrollView = forwardRef<ScrollView, ScrollViewProps>(function HorizontalScrollView(
  props,
  ref,
) {
  const registry = useContext(SwipeScrollContext)
  const gesture = useMemo(() => Gesture.Native(), [])
  useEffect(() => registry?.register(gesture), [registry, gesture])
  return (
    <GestureDetector gesture={gesture}>
      <ScrollView ref={ref} {...props} />
    </GestureDetector>
  )
})
