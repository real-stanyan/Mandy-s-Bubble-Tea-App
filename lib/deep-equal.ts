// Structural equality for JSON-shaped data: objects, arrays, primitives.
// The catalog and the order history come back from the server as fresh
// objects every time; comparing them to what is already held lets a refetch
// that changed nothing leave every reference alone, so nothing downstream
// re-renders for it.

export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    // NaN is the one primitive that is not itself.
    return a !== a && b !== b
  }
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false
    }
    return true
  }
  if (Array.isArray(b)) return false
  const ao = a as Record<string, unknown>
  const bo = b as Record<string, unknown>
  const ak = Object.keys(ao)
  if (ak.length !== Object.keys(bo).length) return false
  for (const k of ak) {
    if (!Object.prototype.hasOwnProperty.call(bo, k) || !deepEqual(ao[k], bo[k])) return false
  }
  return true
}
