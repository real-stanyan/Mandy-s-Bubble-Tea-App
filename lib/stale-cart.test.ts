import { staleCartFrom } from '@/lib/stale-cart'

// Shaped like what lib/api.ts's ApiError carries.
const apiError = (status: number, body: unknown) => ({ status, body })

describe('staleCartFrom', () => {
  it('reads the server message and the ids off a stale-cart 409', () => {
    expect(
      staleCartFrom(
        apiError(409, {
          ok: false,
          error: 'Some items in your cart are no longer on the menu. Remove them and add them again.',
          unknownVariationIds: ['V1', 'V2'],
        }),
      ),
    ).toEqual({
      reason: 'stale-cart',
      message:
        'Some items in your cart are no longer on the menu. Remove them and add them again.',
      variationIds: ['V1', 'V2'],
    })
  })

  // The status alone can't be the key: /api/orders answers 409 for these two
  // as well, and neither means the cart is stale.
  it('ignores the sold-out 409', () => {
    expect(
      staleCartFrom(apiError(409, { ok: false, error: 'Sold out', soldOut: ['V9'] })),
    ).toBeNull()
  })

  it('ignores the duplicate-submit 409', () => {
    expect(
      staleCartFrom(apiError(409, { ok: false, error: 'Order already submitted' })),
    ).toBeNull()
  })

  it('ignores every other status, even with the ids present', () => {
    expect(
      staleCartFrom(apiError(500, { unknownVariationIds: ['V1'] })),
    ).toBeNull()
  })

  it('falls back to its own wording when the server sent no message', () => {
    const stale = staleCartFrom(apiError(409, { unknownVariationIds: ['V1'] }))
    expect(stale?.message).toBe('Some items in your cart are no longer on the menu.')
  })

  it('drops non-string ids rather than rendering "undefined"', () => {
    expect(
      staleCartFrom(apiError(409, { unknownVariationIds: ['V1', null, 7] }))?.variationIds,
    ).toEqual(['V1'])
  })

  it('survives the failures that carry no body at all', () => {
    expect(staleCartFrom(new Error('Network request failed'))).toBeNull()
    expect(staleCartFrom(apiError(409, 'not json at all'))).toBeNull()
    expect(staleCartFrom(null)).toBeNull()
    expect(staleCartFrom(undefined)).toBeNull()
  })
})
