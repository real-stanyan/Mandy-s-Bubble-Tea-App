import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
  type RefObject,
} from 'react'
import { useWindowDimensions, type View } from 'react-native'
import { NavigationContext } from '@react-navigation/native'
import { makeMutable, useDerivedValue, useSharedValue, type SharedValue } from 'react-native-reanimated'

// The gates of the ambient clock (lib/motion/ambient). A gate is a shared
// value, 1 or 0, that every loop under it reads on the UI thread: shut, the
// loops hold frame zero and send nothing native; open, they run on the
// clock. A scene — an illustration, a hero, the member card — opens one
// from two things: whether the screen it sits on is focused (the four tab
// pages stay mounted side by side, and a pushed route covers them all), and
// whether it is inside the scroll viewport, on a page that has said where it
// scrolls to (ScrollScopeProvider). The loop hook itself is in
// components/brand/art-kit, next to the parts it drives.

const OPEN: SharedValue<number> = makeMutable(1)
const LoopGateContext = createContext<SharedValue<number>>(OPEN)

/** The gate the loops here read; always open outside any scope. */
export function useLoopGate(): SharedValue<number> {
  return useContext(LoopGateContext)
}

export function LoopScope({ gate, children }: { gate: SharedValue<number>; children: ReactNode }) {
  return <LoopGateContext.Provider value={gate}>{children}</LoopGateContext.Provider>
}

/* ------------------------------ scrolling ------------------------------ */

/** What a scrolling page tells the scenes on it: where it is, how tall the
 *  window is, and when its content has moved (so a scene that measured its
 *  own place measures it again). */
export type ScrollScope = {
  scrollY: SharedValue<number>
  viewportH: number
  subscribe: (relayout: () => void) => () => void
  /** The content changed size: everything below the change has moved. */
  notify: () => void
}

const ScrollScopeContext = createContext<ScrollScope | null>(null)
export const ScrollScopeProvider = ScrollScopeContext.Provider

export function useScrollScope(scrollY: SharedValue<number>): ScrollScope {
  const { height } = useWindowDimensions()
  const listeners = useRef(new Set<() => void>())
  return useMemo(
    () => ({
      scrollY,
      viewportH: height,
      subscribe: (relayout) => {
        listeners.current.add(relayout)
        return () => {
          listeners.current.delete(relayout)
        }
      },
      notify: () => {
        listeners.current.forEach((relayout) => relayout())
      },
    }),
    [scrollY, height],
  )
}

/* -------------------------------- focus -------------------------------- */

/** 1 while the screen this sits on is focused — its tab selected and no
 *  route pushed over it. Follows the screen's own focus/blur events, so
 *  nothing re-renders when it changes; 1 outside any navigator. */
export function useFocusValue(): SharedValue<number> {
  const navigation = useContext(NavigationContext)
  const focused = useSharedValue(1)
  useEffect(() => {
    if (!navigation) return
    focused.value = navigation.isFocused() ? 1 : 0
    const offFocus = navigation.addListener('focus', () => {
      focused.value = 1
    })
    const offBlur = navigation.addListener('blur', () => {
      focused.value = 0
    })
    return () => {
      offFocus()
      offBlur()
    }
  }, [navigation, focused])
  return focused
}

/* -------------------------------- scenes ------------------------------- */

/** Where a scene sits in its page's scroll content, when the page knows. */
export type Placement = { top: number; height: number }

/** Past the window's edges a scene still counts as visible: it is about to
 *  be, and a loop already a step into its cycle reads better than one
 *  starting cold as the tile slides in. */
export const VIEW_PAD = 80

export type SceneGate = {
  gate: SharedValue<number>
  /** For a scene that measures itself: put these on the view that holds the drawing. */
  ref: RefObject<View | null>
  onLayout: () => void
}

/** Whether a scene at `top` (content coordinates, `height` tall) is within
 *  VIEW_PAD of a window `viewportH` tall scrolled to `scrollY`. */
export function sceneInView(top: number, height: number, scrollY: number, viewportH: number): boolean {
  'worklet'
  return top + height + VIEW_PAD > scrollY && top - VIEW_PAD < scrollY + viewportH
}

/**
 * The gate for one scene: open while its screen is focused and — inside a
 * ScrollScopeProvider — while it is within VIEW_PAD of the window. Given a
 * `placement`, its place is known (a list laid out by arithmetic); without
 * one it measures itself on layout and whenever the page's content moves.
 * A scene that has not been measured counts as visible: the gate fails
 * open, never shut.
 */
export function useSceneGate(placement?: Placement): SceneGate {
  const scope = useContext(ScrollScopeContext)
  const focus = useFocusValue()
  const known = placement !== undefined
  const top = useSharedValue(placement ? placement.top : -1)
  const height = useSharedValue(placement ? placement.height : 0)
  const placedTop = placement?.top
  const placedHeight = placement?.height
  useEffect(() => {
    if (placedTop === undefined || placedHeight === undefined) return
    top.value = placedTop
    height.value = placedHeight
  }, [placedTop, placedHeight, top, height])

  const ref = useRef<View | null>(null)
  const measure = useCallback(() => {
    if (known || !scope) return
    // After the layout that reported this has been committed.
    requestAnimationFrame(() => {
      ref.current?.measureInWindow((_x, y, _w, h) => {
        if (!Number.isFinite(y) || !Number.isFinite(h) || h <= 0) return
        // Window → content: the pages run from the top edge of the screen,
        // so the window's y is the content's y less the scroll.
        top.value = y + scope.scrollY.value
        height.value = h
      })
    })
  }, [known, scope, top, height])
  useEffect(() => {
    if (known || !scope) return
    return scope.subscribe(measure)
  }, [known, scope, measure])

  const scrollY = scope?.scrollY ?? null
  const viewportH = scope?.viewportH ?? 0
  const gate = useDerivedValue<number>(() => {
    if (focus.value <= 0) return 0
    if (scrollY === null) return 1
    const t = top.value
    if (t < 0) return 1
    return sceneInView(t, height.value, scrollY.value, viewportH) ? 1 : 0
  })
  return { gate, ref, onLayout: measure }
}
