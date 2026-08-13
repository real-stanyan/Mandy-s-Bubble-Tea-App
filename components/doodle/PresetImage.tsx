import { useEffect, useState } from 'react'
import { Image as ExpoImage, type ImageStyle } from 'expo-image'
import { bundledPreset, presetRemoteCandidates } from '@/lib/doodle/gallery-remote'

/**
 * A gallery preset rendered from its hash alone.
 *
 * A cart selection stores `{ kind: 'preset', hash }`, so anything drawing
 * from one has to find the art itself. It lives in the binary for most
 * builtins, in Supabase Storage for uploads, and in the web app's public
 * folder for builtins added after the binary was cut. Which of the three is
 * not knowable from the hash, so this walks them in order and steps to the
 * next on error — the same shape SquareImage uses for its optimizer
 * fallback.
 *
 * Before this, the checkout preview indexed the bundled manifest directly
 * and rendered nothing at all for the other two cases: the customer chose a
 * design and their cup card showed a blank white square.
 */
export function PresetImage({ hash, style }: { hash: string; style?: ImageStyle }) {
  const bundled = bundledPreset(hash)
  const candidates = presetRemoteCandidates(hash)
  const [attempt, setAttempt] = useState(0)

  // A recycled instance may be handed a different cup's hash; start its
  // search from the top rather than from wherever the last one gave up.
  useEffect(() => {
    setAttempt(0)
  }, [hash])

  const source = bundled ?? { uri: candidates[Math.min(attempt, candidates.length - 1)] }

  return (
    <ExpoImage
      source={source}
      style={style}
      contentFit="contain"
      cachePolicy="memory-disk"
      transition={120}
      onError={() => {
        if (!bundled && attempt < candidates.length - 1) setAttempt((a) => a + 1)
      }}
    />
  )
}
