import { useEffect, useState } from 'react'
import { Image, type ImageProps } from 'expo-image'
import {
  imageUriFor,
  shouldFallback,
  SQUARE_IMAGE_HEADERS,
} from '@/lib/optimized-image'

interface Props extends Omit<ImageProps, 'source' | 'onError'> {
  /** Raw Square catalog image URL (as delivered by /api/catalog). */
  url: string
  /** Width tier — use IMG_THUMB / IMG_HERO from lib/optimized-image. */
  width: number
}

/**
 * Renders a Square catalog photo through the web `/_next/image` optimizer,
 * falling back to the raw S3 URL if the optimizer errors (402/5xx/timeout).
 *
 * Deliberately carries no intrinsic size: sizing comes entirely from the
 * `style` prop so existing layouts (fixed thumbs, absoluteFill, full-width
 * aspect-ratio hero) are untouched.
 */
export function SquareImage({ url, width, style, ...rest }: Props) {
  const [failed, setFailed] = useState(false)

  // A recycled component instance may receive a different item's URL;
  // reset the fallback state so the new image tries the optimizer first.
  useEffect(() => {
    setFailed(false)
  }, [url])

  return (
    <Image
      source={{ uri: imageUriFor(url, width, failed), headers: SQUARE_IMAGE_HEADERS }}
      style={style}
      contentFit="cover"
      cachePolicy="memory-disk"
      transition={150}
      onError={() => {
        if (shouldFallback(url, width, failed)) setFailed(true)
      }}
      {...rest}
    />
  )
}
